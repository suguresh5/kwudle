package suggestions

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/sentinel/worker/src/config"
	"github.com/sentinel/worker/src/db"
)

// Job collects 30-day metrics from ClickHouse, sends them to the dashboard
// generate endpoint (which calls the Gemini API), and writes AI suggestions
// back to the database. Runs once on startup and then every 24 hours.
//
// Each active tenant is processed independently so that AI suggestions are
// scoped per-tenant rather than being global.
type Job struct {
	cfg        *config.Config
	chClient   *db.ClickHouseClient
	httpClient *http.Client
}

func NewJob(cfg *config.Config, chClient *db.ClickHouseClient) *Job {
	return &Job{
		cfg:        cfg,
		chClient:   chClient,
		httpClient: &http.Client{Timeout: 90 * time.Second},
	}
}

// Start runs the job once immediately, then every 24h.
func (j *Job) Start(ctx context.Context) {
	if j.cfg.DashboardURL == "" {
		slog.Warn("suggestion job: DASHBOARD_INTERNAL_URL not configured — AI suggestions disabled")
		return
	}
	if j.cfg.GeminiAPIKey == "" {
		slog.Warn("suggestion job: GEMINI_API_KEY not set — AI suggestions will be skipped by the dashboard generate endpoint")
	}

	// Run once right away
	j.run(ctx)

	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	slog.Info("suggestion job started", "interval", "24h")

	for {
		select {
		case <-ticker.C:
			j.run(ctx)
		case <-ctx.Done():
			return
		}
	}
}

func (j *Job) run(ctx context.Context) {
	slog.Info("suggestion job: fetching active tenants")

	tenants, err := j.chClient.ListActiveTenants(ctx)
	if err != nil {
		slog.Error("suggestion job: failed to list active tenants", "error", err)
		return
	}
	if len(tenants) == 0 {
		slog.Info("suggestion job: no active tenants found — skipping")
		return
	}

	slog.Info("suggestion job: running for all active tenants", "count", len(tenants))

	for _, tenantID := range tenants {
		if err := j.generateForTenant(ctx, tenantID); err != nil {
			slog.Error("suggestion job: failed for tenant", "tenant_id", tenantID, "error", err)
			// Continue to next tenant; one failure should not block others.
		}
	}

	slog.Info("suggestion job: completed all tenants")
}

func (j *Job) generateForTenant(ctx context.Context, tenantID string) error {
	payload := map[string]interface{}{
		"tenant_id": tenantID,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	url := fmt.Sprintf("%s/api/suggestions/generate", j.cfg.DashboardURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if j.cfg.InternalAPIKey != "" {
		req.Header.Set("X-Internal-Key", j.cfg.InternalAPIKey)
	}

	resp, err := j.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("HTTP request: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}

	if success, ok := result["success"].(bool); ok && success {
		slog.Info("suggestion job: generated suggestions for tenant",
			"tenant_id", tenantID, "count", result["count"])
		return nil
	}

	return fmt.Errorf("generate endpoint returned error: %v", result["error"])
}
