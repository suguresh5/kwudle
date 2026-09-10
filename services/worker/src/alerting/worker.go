package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/sentinel/worker/src/config"
)

// AlertRule mirrors sentinel.alert_rules
type AlertRule struct {
	ID             string
	TenantID       string
	Metric         string
	Operator       string // gt | lt | eq
	Threshold      float64
	WindowSeconds  uint32
	NotifyChannel  string
	NotifyWebhook  string
	Active         bool
	LastFiredAt    *time.Time
}

type DLQReader interface {
	DLQDepth() int
}

type ClickHouseReader interface {
	QueryAlertRules(ctx context.Context) ([]AlertRule, error)
	QueryMetricValue(ctx context.Context, tenantID, metric string, windowSeconds uint32) (float64, error)
	UpdateAlertLastFired(ctx context.Context, ruleID string, firedAt time.Time) error
}

// Worker evaluates all active alert rules every tick.
type Worker struct {
	ch  ClickHouseReader
	dlq DLQReader
	cfg *config.Config
	hc  *http.Client
}

func NewWorker(ch ClickHouseReader, cfg *config.Config) *Worker {
	return &Worker{
		ch:  ch,
		cfg: cfg,
		hc:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (w *Worker) SetDLQReader(dlq DLQReader) {
	w.dlq = dlq
}

// Evaluate queries all active alert rules and fires webhooks for breaches.
func (w *Worker) Evaluate(ctx context.Context) error {
	rules, err := w.ch.QueryAlertRules(ctx)
	if err != nil {
		return fmt.Errorf("fetch alert rules: %w", err)
	}

	now := time.Now().UTC()
	minRefireInterval := time.Duration(w.cfg.AlertMinRefireS) * time.Second

	for _, rule := range rules {
		if !rule.Active {
			continue
		}

		// Enforce minimum re-fire interval
		if rule.LastFiredAt != nil && now.Sub(*rule.LastFiredAt) < minRefireInterval {
			continue
		}

		var value float64
		if rule.Metric == "dlq_depth" {
			if w.dlq != nil {
				value = float64(w.dlq.DLQDepth())
			}
		} else {
			var err error
			value, err = w.ch.QueryMetricValue(ctx, rule.TenantID, rule.Metric, rule.WindowSeconds)
			if err != nil {
				slog.Warn("metric query failed", "rule_id", rule.ID, "metric", rule.Metric, "error", err)
				continue
			}
		}

		if w.breached(rule, value) {
			slog.Info("alert fired",
				"rule_id", rule.ID,
				"metric", rule.Metric,
				"value", value,
				"threshold", rule.Threshold,
				"operator", rule.Operator,
				"tenant_id", rule.TenantID)

			if err := w.fire(ctx, rule, value, now); err != nil {
				slog.Error("webhook delivery failed", "rule_id", rule.ID, "error", err)
				continue
			}

			if err := w.ch.UpdateAlertLastFired(ctx, rule.ID, now); err != nil {
				slog.Warn("failed to update last_fired_at", "rule_id", rule.ID, "error", err)
			}
		}
	}
	return nil
}

func (w *Worker) breached(rule AlertRule, value float64) bool {
	switch rule.Operator {
	case "gt":
		return value > rule.Threshold
	case "lt":
		return value < rule.Threshold
	case "eq":
		return value == rule.Threshold
	}
	return false
}

// fire sends the alert to the configured webhook.
// Supports both Slack Incoming Webhooks and PagerDuty Events API v2.
func (w *Worker) fire(ctx context.Context, rule AlertRule, value float64, firedAt time.Time) error {
	var payload []byte
	var err error

	switch rule.NotifyChannel {
	case "slack":
		payload, err = json.Marshal(slackPayload(rule, value, firedAt))
	case "pagerduty":
		payload, err = json.Marshal(pagerdutyPayload(rule, value, firedAt))
	default:
		payload, err = json.Marshal(genericPayload(rule, value, firedAt))
	}
	if err != nil {
		return fmt.Errorf("marshal webhook payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, rule.NotifyWebhook,
		bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := w.hc.Do(req)
	if err != nil {
		return fmt.Errorf("webhook request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned %d", resp.StatusCode)
	}
	return nil
}

// ─── Webhook payload formatters ───────────────────────────────────────────────

func slackPayload(rule AlertRule, value float64, firedAt time.Time) map[string]interface{} {
	return map[string]interface{}{
		"text": fmt.Sprintf("🚨 *Sentinel Alert*: `%s` is *%.2f* (threshold: %s %.2f)\nTenant: `%s` | Rule: `%s`",
			rule.Metric, value, rule.Operator, rule.Threshold, rule.TenantID, rule.ID),
		"username":   "Sentinel",
		"icon_emoji": ":rotating_light:",
	}
}

func pagerdutyPayload(rule AlertRule, value float64, firedAt time.Time) map[string]interface{} {
	return map[string]interface{}{
		"routing_key":  rule.NotifyWebhook, // PD integration key goes in the webhook field
		"event_action": "trigger",
		"dedup_key":    rule.ID,
		"payload": map[string]interface{}{
			"summary":   fmt.Sprintf("Sentinel: %s breached threshold (%.2f %s %.2f)", rule.Metric, value, rule.Operator, rule.Threshold),
			"severity":  "error",
			"source":    "sentinel",
			"timestamp": firedAt.Format(time.RFC3339),
			"custom_details": map[string]interface{}{
				"tenant_id": rule.TenantID,
				"metric":    rule.Metric,
				"value":     value,
				"threshold": rule.Threshold,
				"operator":  rule.Operator,
			},
		},
	}
}

func genericPayload(rule AlertRule, value float64, firedAt time.Time) map[string]interface{} {
	return map[string]interface{}{
		"rule_id":   rule.ID,
		"tenant_id": rule.TenantID,
		"metric":    rule.Metric,
		"value":     value,
		"threshold": rule.Threshold,
		"operator":  rule.Operator,
		"fired_at":  firedAt.Format(time.RFC3339),
	}
}
