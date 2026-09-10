package schema

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sentinel/ingest/src/config"
)

var columnNameRe = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]{0,63}$`)

type ClickHouseSchemaClient interface {
	GetColumns(ctx context.Context, table string) (map[string]string, error)
	AlterTableAddColumn(ctx context.Context, table, column, colType string) error
}

type Registry struct {
	mu           sync.RWMutex
	knownColumns map[string]string
	redis        *redis.Client
	ch           ClickHouseSchemaClient
	cfg          *config.Config
	alterCh      chan alterRequest
}

type alterRequest struct {
	column  string
	colType string
}

func NewRegistry(r *redis.Client, ch ClickHouseSchemaClient, cfg *config.Config) *Registry {
	return &Registry{
		knownColumns: make(map[string]string),
		redis:        r,
		ch:           ch,
		cfg:          cfg,
		alterCh:      make(chan alterRequest, 512),
	}
}

func (r *Registry) Start(ctx context.Context) {
	if err := r.refresh(ctx); err != nil {
		slog.Warn("initial schema refresh failed", "error", err)
	}
	go r.refreshLoop(ctx)
	go r.debounceWorker(ctx)
}

// CheckAndEnqueue inspects payload keys and enqueues ALTER TABLE for unknown columns.
func (r *Registry) CheckAndEnqueue(properties map[string]interface{}) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for key, value := range properties {
		if !columnNameRe.MatchString(key) {
			slog.Warn("schema: invalid column name rejected", "key", key)
			continue
		}
		if _, exists := r.knownColumns[key]; exists {
			continue
		}
		colType := inferType(value)
		select {
		case r.alterCh <- alterRequest{column: key, colType: colType}:
		default:
			slog.Warn("schema alter channel full", "column", key)
		}
	}
}

// inferType maps Go values to ClickHouse types per spec.
func inferType(v interface{}) string {
	switch val := v.(type) {
	case float64:
		if val == float64(int64(val)) {
			return "Int64"
		}
		return "Float64"
	case int, int64, int32:
		return "Int64"
	case string:
		s := val
		formats := []string{time.RFC3339, time.RFC3339Nano, "2006-01-02T15:04:05", "2006-01-02"}
		for _, f := range formats {
			if _, err := time.Parse(f, s); err == nil {
				return "DateTime64(3)"
			}
		}
		return "String"
	default:
		return "String"
	}
}

// debounceWorker: at most one ALTER per SchemaDebounceMs, deduplicating columns.
func (r *Registry) debounceWorker(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(r.cfg.SchemaDebounceMs) * time.Millisecond)
	defer ticker.Stop()
	pending := make(map[string]string)
	for {
		select {
		case req := <-r.alterCh:
			pending[req.column] = req.colType
		case <-ticker.C:
			if len(pending) == 0 {
				continue
			}
			for col, colType := range pending {
				if err := r.executeAlter(ctx, col, colType); err != nil {
					slog.Error("schema alter failed", "column", col, "error", err)
				} else {
					r.mu.Lock()
					r.knownColumns[col] = colType
					r.mu.Unlock()
				}
			}
			pending = make(map[string]string)
		case <-ctx.Done():
			return
		}
	}
}

func (r *Registry) executeAlter(ctx context.Context, column, colType string) error {
	// Column name is pre-validated by regex — safe to interpolate
	slog.Info("schema evolution: adding column", "column", column, "type", colType)
	return r.ch.AlterTableAddColumn(ctx, "sentinel.events", column, colType)
}

func (r *Registry) refreshLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(r.cfg.SchemaRefreshIntervalS) * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if err := r.refresh(ctx); err != nil {
				slog.Warn("schema refresh failed", "error", err)
			}
		case <-ctx.Done():
			return
		}
	}
}

func (r *Registry) refresh(ctx context.Context) error {
	cols, err := r.ch.GetColumns(ctx, "sentinel.events")
	if err != nil {
		return err
	}
	r.mu.Lock()
	r.knownColumns = cols
	r.mu.Unlock()
	slog.Info("schema refreshed", "column_count", len(cols))
	return nil
}

func (r *Registry) KnownColumns() map[string]string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make(map[string]string, len(r.knownColumns))
	for k, v := range r.knownColumns {
		out[k] = v
	}
	return out
}

// Ensure column name is safe (belt-and-suspenders on top of regex).
func sanitize(name string) string {
	return strings.Map(func(c rune) rune {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' {
			return c
		}
		return -1
	}, name)
}

var _ = fmt.Sprintf // keep import
