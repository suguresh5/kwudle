package batcher

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/sentinel/ingest/src/config"
	"github.com/sentinel/ingest/src/model"
)

type mockClickHouseWriter struct {
	mu           sync.Mutex
	inserted     []*model.Event
	shouldFail   bool
	failAttempts int
	calls        int
}

func (m *mockClickHouseWriter) InsertEvents(ctx context.Context, events []*model.Event) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls++
	if m.shouldFail {
		return errors.New("clickhouse connection refused")
	}
	if m.failAttempts > 0 {
		m.failAttempts--
		return errors.New("transient clickhouse error")
	}
	m.inserted = append(m.inserted, events...)
	return nil
}

func TestBatcherFlushOnSize(t *testing.T) {
	mockCH := &mockClickHouseWriter{}
	cfg := &config.Config{
		BatcherFlushSize:       3,
		BatcherFlushIntervalMs: 10000,
		BatcherMaxRetries:      1,
		BatcherRetryInitialMs:  10,
		BatcherRetryMaxMs:      50,
		DLQPath:                os.DevNull,
	}

	b := NewBatcher(mockCH, cfg)

	// Add 2 events (should not trigger flush yet)
	b.Add(&model.Event{EventID: uuid.NewString(), EventType: "PageView"})
	b.Add(&model.Event{EventID: uuid.NewString(), EventType: "PageView"})

	time.Sleep(50 * time.Millisecond)
	mockCH.mu.Lock()
	if len(mockCH.inserted) != 0 {
		t.Errorf("expected 0 events inserted, got %d", len(mockCH.inserted))
	}
	mockCH.mu.Unlock()

	// Add 3rd event (should trigger flush of 3)
	b.Add(&model.Event{EventID: uuid.NewString(), EventType: "Purchase"})

	// Give the async goroutine time to complete flush
	time.Sleep(100 * time.Millisecond)

	mockCH.mu.Lock()
	if len(mockCH.inserted) != 3 {
		t.Errorf("expected 3 events inserted, got %d", len(mockCH.inserted))
	}
	mockCH.mu.Unlock()
}

func TestBatcherDrain(t *testing.T) {
	mockCH := &mockClickHouseWriter{}
	cfg := &config.Config{
		BatcherFlushSize:       100,
		BatcherFlushIntervalMs: 10000,
		BatcherMaxRetries:      1,
		BatcherRetryInitialMs:  10,
		BatcherRetryMaxMs:      50,
		DLQPath:                os.DevNull,
	}

	b := NewBatcher(mockCH, cfg)

	b.Add(&model.Event{EventID: uuid.NewString(), EventType: "Event1"})
	b.Add(&model.Event{EventID: uuid.NewString(), EventType: "Event2"})

	// Force drain (e.g. shutdown)
	b.Drain(context.Background())

	mockCH.mu.Lock()
	if len(mockCH.inserted) != 2 {
		t.Errorf("expected 2 events inserted on drain, got %d", len(mockCH.inserted))
	}
	mockCH.mu.Unlock()
}

func TestBatcherDLQFallback(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "dlq_test_*.log")
	if err != nil {
		t.Fatalf("create temp dlq file: %v", err)
	}
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	mockCH := &mockClickHouseWriter{shouldFail: true}
	cfg := &config.Config{
		BatcherFlushSize:       2,
		BatcherFlushIntervalMs: 10000,
		BatcherMaxRetries:      2,
		BatcherRetryInitialMs:  5,
		BatcherRetryMaxMs:      20,
		DLQPath:                tmpFile.Name(),
	}

	b := NewBatcher(mockCH, cfg)

	b.Add(&model.Event{EventID: uuid.NewString(), EventType: "FailedEvent1"})
	b.Add(&model.Event{EventID: uuid.NewString(), EventType: "FailedEvent2"})

	// Wait for retries and DLQ write
	time.Sleep(200 * time.Millisecond)

	b.metrics.mu.Lock()
	dlqWrites := b.metrics.dlqWrites
	b.metrics.mu.Unlock()

	if dlqWrites == 0 {
		t.Errorf("expected dlqWrites > 0 after failure retries exhausted")
	}

	data, err := os.ReadFile(tmpFile.Name())
	if err != nil {
		t.Fatalf("read DLQ file: %v", err)
	}
	if len(data) == 0 {
		t.Errorf("expected DLQ file to contain serialized failed events")
	}
}
