package dlq

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/sentinel/worker/src/config"
)

type DLQRecord struct {
	FailedAt    string        `json:"failed_at"`
	RetryReason string        `json:"retry_reason"`
	BatchSize   int           `json:"batch_size"`
	Events      []interface{} `json:"events"`
}

// Replayer reads the DLQ NDJSON file and re-POSTs batches to the ingest service.
type Replayer struct {
	cfg        *config.Config
	httpClient *http.Client
}

func NewReplayer(cfg *config.Config) *Replayer {
	return &Replayer{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Replay reads all records from the DLQ file and re-submits them.
// Successfully replayed records are removed from the file.
func (r *Replayer) Replay(ctx context.Context) (int, int, error) {
	f, err := os.Open(r.cfg.DLQPath)
	if os.IsNotExist(err) {
		return 0, 0, nil
	}
	if err != nil {
		return 0, 0, fmt.Errorf("open DLQ: %w", err)
	}
	defer f.Close()

	var records []DLQRecord
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 10*1024*1024), 10*1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		var rec DLQRecord
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			slog.Warn("DLQ: skipping malformed line", "error", err)
			continue
		}
		records = append(records, rec)
	}
	if err := scanner.Err(); err != nil {
		return 0, 0, fmt.Errorf("scan DLQ: %w", err)
	}

	succeeded, failed := 0, 0
	var remaining []DLQRecord
	for _, rec := range records {
		if err := r.replayRecord(ctx, rec); err != nil {
			slog.Error("DLQ replay failed", "error", err, "failed_at", rec.FailedAt)
			remaining = append(remaining, rec)
			failed++
		} else {
			succeeded++
		}
	}

	// Rewrite DLQ with only failed records
	if err := r.rewriteDLQ(remaining); err != nil {
		slog.Error("DLQ rewrite failed", "error", err)
	}

	slog.Info("DLQ replay complete",
		"total", len(records),
		"succeeded", succeeded,
		"failed", failed)
	return succeeded, failed, nil
}

func (r *Replayer) replayRecord(ctx context.Context, rec DLQRecord) error {
	body, err := json.Marshal(rec.Events)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, r.cfg.IngestReplayURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Replay", "true")

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("replay endpoint returned %d", resp.StatusCode)
	}
	return nil
}

func (r *Replayer) rewriteDLQ(remaining []DLQRecord) error {
	f, err := os.Create(r.cfg.DLQPath)
	if err != nil {
		return err
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	for _, rec := range remaining {
		if err := enc.Encode(rec); err != nil {
			return err
		}
	}
	return nil
}

// ── DLQ Metrics ───────────────────────────────────────────────────────────────

// DLQDepth returns the number of records currently in the DLQ file.
// Returns 0 if the file does not exist.
func (r *Replayer) DLQDepth() int {
	f, err := os.Open(r.cfg.DLQPath)
	if os.IsNotExist(err) {
		return 0
	}
	if err != nil {
		slog.Warn("DLQDepth: open error", "error", err)
		return 0
	}
	defer f.Close()

	count := 0
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for scanner.Scan() {
		if scanner.Text() != "" {
			count++
		}
	}
	return count
}

// OldestRecordAge returns the age in seconds of the oldest DLQ record,
// based on its failed_at field. Returns 0 if DLQ is empty or file not found.
func (r *Replayer) OldestRecordAge() float64 {
	f, err := os.Open(r.cfg.DLQPath)
	if os.IsNotExist(err) {
		return 0
	}
	if err != nil {
		slog.Warn("OldestRecordAge: open error", "error", err)
		return 0
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		var rec DLQRecord
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			continue
		}
		if rec.FailedAt == "" {
			continue
		}
		t, err := time.Parse(time.RFC3339, rec.FailedAt)
		if err != nil {
			// Try ISO 8601 with space separator
			t, err = time.Parse("2006-01-02 15:04:05", rec.FailedAt)
			if err != nil {
				continue
			}
		}
		return time.Since(t).Seconds()
	}
	return 0
}
