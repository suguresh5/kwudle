package batcher

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"math/rand"
	"os"
	"sync"
	"time"

	"github.com/sentinel/ingest/src/config"
	"github.com/sentinel/ingest/src/model"
)

// ClickHouseWriter is the minimal interface the batcher needs.
type ClickHouseWriter interface {
	InsertEvents(ctx context.Context, events []*model.Event) error
}

// Batcher accumulates events and flushes to ClickHouse on two triggers:
//  1. Buffer reaches BatcherFlushSize events
//  2. BatcherFlushIntervalMs has elapsed since last flush
//
// On ClickHouse failure it retries with exponential backoff + ±10% jitter.
// After MaxRetries it writes the batch to the dead-letter queue file.
type Batcher struct {
	mu         sync.Mutex
	buf        []*model.Event
	ch         ClickHouseWriter
	cfg        *config.Config
	flushTick  *time.Ticker
	dlqFile    *os.File
	metrics    *batcherMetrics
}

type batcherMetrics struct {
	mu          sync.Mutex
	queueDepth  int
	totalFlushed int64
	dlqWrites   int64
}

func NewBatcher(ch ClickHouseWriter, cfg *config.Config) *Batcher {
	return &Batcher{
		buf:     make([]*model.Event, 0, cfg.BatcherFlushSize),
		ch:      ch,
		cfg:     cfg,
		metrics: &batcherMetrics{},
	}
}

// Start begins the interval flush timer.
func (b *Batcher) Start(ctx context.Context) {
	interval := time.Duration(b.cfg.BatcherFlushIntervalMs) * time.Millisecond
	b.flushTick = time.NewTicker(interval)

	// Open DLQ file in append mode
	f, err := os.OpenFile(b.cfg.DLQPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		slog.Warn("could not open DLQ file", "path", b.cfg.DLQPath, "error", err)
	} else {
		b.dlqFile = f
	}

	go func() {
		for {
			select {
			case <-b.flushTick.C:
				b.flush(ctx)
			case <-ctx.Done():
				return
			}
		}
	}()
}

// Add appends an event to the buffer and triggers a flush if full.
func (b *Batcher) Add(event *model.Event) {
	b.mu.Lock()
	b.buf = append(b.buf, event)
	depth := len(b.buf)
	b.metrics.mu.Lock()
	b.metrics.queueDepth = depth
	b.metrics.mu.Unlock()
	var batch []*model.Event
	if depth >= b.cfg.BatcherFlushSize {
		batch = b.drain()
	}
	b.mu.Unlock()

	if batch != nil {
		go b.flushWithRetry(context.Background(), batch)
	}
}

// Drain flushes everything remaining — called on graceful shutdown.
func (b *Batcher) Drain(ctx context.Context) {
	b.mu.Lock()
	batch := b.drain()
	b.mu.Unlock()
	if len(batch) > 0 {
		b.flushWithRetry(ctx, batch)
	}
	if b.flushTick != nil {
		b.flushTick.Stop()
	}
	if b.dlqFile != nil {
		b.dlqFile.Close()
	}
}

func (b *Batcher) flush(ctx context.Context) {
	b.mu.Lock()
	batch := b.drain()
	b.mu.Unlock()
	if len(batch) > 0 {
		b.flushWithRetry(ctx, batch)
	}
}

func (b *Batcher) drain() []*model.Event {
	if len(b.buf) == 0 {
		return nil
	}
	batch := b.buf
	b.buf = make([]*model.Event, 0, b.cfg.BatcherFlushSize)
	return batch
}

func (b *Batcher) flushWithRetry(ctx context.Context, batch []*model.Event) {
	initialMs := float64(b.cfg.BatcherRetryInitialMs)
	maxMs := float64(b.cfg.BatcherRetryMaxMs)

	for attempt := 0; attempt <= b.cfg.BatcherMaxRetries; attempt++ {
		if attempt > 0 {
			backoff := math.Min(initialMs*math.Pow(2, float64(attempt-1)), maxMs)
			jitter := backoff * 0.1 * (rand.Float64()*2 - 1) // ±10%
			sleepMs := time.Duration(backoff+jitter) * time.Millisecond
			slog.Warn("batcher retry",
				"attempt", attempt,
				"sleep_ms", sleepMs.Milliseconds(),
				"batch_size", len(batch))
			select {
			case <-time.After(sleepMs):
			case <-ctx.Done():
				b.writeDLQ(batch, "context cancelled during retry")
				return
			}
		}

		if err := b.ch.InsertEvents(ctx, batch); err != nil {
			slog.Error("clickhouse insert failed",
				"attempt", attempt,
				"error", err,
				"batch_size", len(batch))
			continue
		}

		b.metrics.mu.Lock()
		b.metrics.totalFlushed += int64(len(batch))
		b.metrics.mu.Unlock()
		slog.Info("batch flushed", "size", len(batch))
		return
	}

	// All retries exhausted — write to DLQ
	b.writeDLQ(batch, fmt.Sprintf("max retries (%d) exceeded", b.cfg.BatcherMaxRetries))
}

type dlqRecord struct {
	FailedAt    string        `json:"failed_at"`
	RetryReason string        `json:"retry_reason"`
	BatchSize   int           `json:"batch_size"`
	Events      []*model.Event `json:"events"`
}

func (b *Batcher) writeDLQ(batch []*model.Event, reason string) {
	b.metrics.mu.Lock()
	b.metrics.dlqWrites++
	b.metrics.mu.Unlock()

	rec := dlqRecord{
		FailedAt:    time.Now().UTC().Format(time.RFC3339Nano),
		RetryReason: reason,
		BatchSize:   len(batch),
		Events:      batch,
	}
	data, err := json.Marshal(rec)
	if err != nil {
		slog.Error("DLQ marshal failed", "error", err)
		return
	}
	data = append(data, '\n')

	if b.dlqFile != nil {
		if _, err := b.dlqFile.Write(data); err != nil {
			slog.Error("DLQ write failed", "error", err)
		}
	} else if b.cfg.DLQPath != "" {
		if f, err := os.OpenFile(b.cfg.DLQPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil {
			defer f.Close()
			_, _ = f.Write(data)
		}
	}
	slog.Error("batch written to DLQ",
		"reason", reason,
		"batch_size", len(batch),
		"failed_at", rec.FailedAt)
}

// QueueDepth returns the current number of buffered events (for /metrics).
func (b *Batcher) QueueDepth() int {
	b.metrics.mu.Lock()
	defer b.metrics.mu.Unlock()
	return b.metrics.queueDepth
}
