package db

import (
	"context"
	"fmt"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/sentinel/worker/src/alerting"
	"github.com/sentinel/worker/src/config"
	"github.com/sentinel/worker/src/session"
)

type ClickHouseClient struct {
	conn driver.Conn
	cfg  *config.Config
}

func NewClickHouseClient(cfg *config.Config) (*ClickHouseClient, error) {
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{fmt.Sprintf("%s:%d", cfg.ClickHouseHost, cfg.ClickHousePort)},
		Auth: clickhouse.Auth{
			Database: cfg.ClickHouseDB,
			Username: cfg.ClickHouseUser,
			Password: cfg.ClickHousePassword,
		},
		DialTimeout:  5 * time.Second,
		MaxOpenConns: 10,
		Compression:  &clickhouse.Compression{Method: clickhouse.CompressionLZ4},
	})
	if err != nil {
		return nil, fmt.Errorf("clickhouse open: %w", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := conn.Ping(ctx); err != nil {
		return nil, fmt.Errorf("clickhouse ping: %w", err)
	}
	return &ClickHouseClient{conn: conn, cfg: cfg}, nil
}

// ─── Alert rule queries ───────────────────────────────────────────────────────

func (c *ClickHouseClient) QueryAlertRules(ctx context.Context) ([]alerting.AlertRule, error) {
	rows, err := c.conn.Query(ctx, `
		SELECT id, tenant_id, metric, operator, threshold, window_seconds,
		       notify_channel, notify_webhook, active, last_fired_at
		FROM sentinel.alert_rules FINAL
		WHERE active = 1
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []alerting.AlertRule
	for rows.Next() {
		var r alerting.AlertRule
		var lastFired *time.Time
		if err := rows.Scan(
			&r.ID, &r.TenantID, &r.Metric, &r.Operator, &r.Threshold,
			&r.WindowSeconds, &r.NotifyChannel, &r.NotifyWebhook, &r.Active, &lastFired,
		); err != nil {
			return nil, err
		}
		r.LastFiredAt = lastFired
		rules = append(rules, r)
	}
	return rules, rows.Err()
}

// QueryMetricValue evaluates a named metric for a tenant over the given window.
// Metrics map: "error_rate" | "p99_latency" | "event_count" | "dau"
func (c *ClickHouseClient) QueryMetricValue(ctx context.Context, tenantID, metric string, windowSeconds uint32) (float64, error) {
	var query string
	switch metric {
	case "error_rate":
		query = `
			SELECT countMerge(error_events) / greatest(countMerge(total_events), 1) AS value
			FROM sentinel.mv_error_rate_data
			WHERE tenant_id = ? AND minute_bucket >= now() - INTERVAL ? SECOND`
	case "p99_latency":
		query = `
			SELECT quantileMerge(0.99)(p99_state) AS value
			FROM sentinel.mv_error_rate_data
			WHERE tenant_id = ? AND minute_bucket >= now() - INTERVAL ? SECOND`
	case "event_count":
		query = `
			SELECT countMerge(total_events) AS value
			FROM sentinel.mv_error_rate_data
			WHERE tenant_id = ? AND minute_bucket >= now() - INTERVAL ? SECOND`
	case "dlq_depth":
		return 0, nil
	default:
		return 0, fmt.Errorf("unknown metric: %s", metric)
	}

	var value float64
	if err := c.conn.QueryRow(ctx, query, tenantID, windowSeconds).Scan(&value); err != nil {
		return 0, err
	}
	return value, nil
}

func (c *ClickHouseClient) UpdateAlertLastFired(ctx context.Context, ruleID string, firedAt time.Time) error {
	return c.conn.Exec(ctx,
		"ALTER TABLE sentinel.alert_rules UPDATE last_fired_at = ? WHERE id = ?",
		firedAt, ruleID)
}

func (c *ClickHouseClient) SeedDLQAlertRule(ctx context.Context) error {
	var count uint64
	err := c.conn.QueryRow(ctx, "SELECT count() FROM sentinel.alert_rules FINAL WHERE metric = 'dlq_depth'").Scan(&count)
	if err == nil && count > 0 {
		return nil
	}
	return c.conn.Exec(ctx, `
		INSERT INTO sentinel.alert_rules (
			id, tenant_id, metric, operator, threshold, window_seconds, notify_channel, notify_webhook, active
		) VALUES (
			generateUUIDv4(), '00000000-0000-0000-0000-000000000000', 'dlq_depth', 'gt', 100, 300, 'slack', 'http://localhost:8080/webhook', 1
		)
	`)
}

// ─── Session stitching ────────────────────────────────────────────────────────

// QuerySessionFeed returns unprocessed events from the session feed MV
// for the window since lastProcessed.
func (c *ClickHouseClient) QuerySessionFeed(ctx context.Context, lastProcessed time.Time) ([]session.FeedRow, error) {
	rows, err := c.conn.Query(ctx, `
		SELECT tenant_id, user_id, event_id, timestamp, event_type, country, device_type, properties
		FROM sentinel.mv_session_feed_data
		WHERE timestamp > ?
		ORDER BY tenant_id, user_id, timestamp
		LIMIT 1000000
	`, lastProcessed)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feed []session.FeedRow
	for rows.Next() {
		var r session.FeedRow
		if err := rows.Scan(
			&r.TenantID, &r.UserID, &r.EventID, &r.Timestamp,
			&r.EventType, &r.Country, &r.DeviceType, &r.Properties,
		); err != nil {
			return nil, err
		}
		feed = append(feed, r)
	}
	return feed, rows.Err()
}

// UpsertSessions bulk-inserts stitched sessions into sentinel.sessions.
func (c *ClickHouseClient) UpsertSessions(ctx context.Context, sessions []session.Session) error {
	batch, err := c.conn.PrepareBatch(ctx, `INSERT INTO sentinel.sessions (
		tenant_id, session_id, user_id, session_start, session_end,
		duration_ms, page_depth, event_count, converted,
		entry_page, exit_page, country, device_type
	)`)
	if err != nil {
		return err
	}
	for _, s := range sessions {
		if err := batch.Append(
			s.TenantID, s.SessionID, s.UserID, s.SessionStart, s.SessionEnd,
			s.DurationMs, s.PageDepth, s.EventCount, s.Converted,
			s.EntryPage, s.ExitPage, s.Country, s.DeviceType,
		); err != nil {
			return err
		}
	}
	return batch.Send()
}

// ListActiveTenants returns all tenant UUIDs that are currently active.
// Used by the suggestions job to iterate over every tenant.
func (c *ClickHouseClient) ListActiveTenants(ctx context.Context) ([]string, error) {
	rows, err := c.conn.Query(ctx, `
		SELECT toString(tenant_id)
		FROM sentinel.tenants FINAL
		WHERE active = 1
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list active tenants: %w", err)
	}
	defer rows.Close()

	var tenants []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		tenants = append(tenants, id)
	}
	return tenants, rows.Err()
}

func (c *ClickHouseClient) Close() { c.conn.Close() }
