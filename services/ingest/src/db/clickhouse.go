package db

import (
"context"
"fmt"
"time"

clickhouse "github.com/ClickHouse/clickhouse-go/v2"
"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
"github.com/sentinel/ingest/src/config"
"github.com/sentinel/ingest/src/model"
)

type ClickHouseClient struct {
conn driver.Conn
}

func NewClickHouseClient(cfg *config.Config) (*ClickHouseClient, error) {
conn, err := clickhouse.Open(&clickhouse.Options{
Addr: []string{fmt.Sprintf("%s:%d", cfg.ClickHouseHost, cfg.ClickHousePort)},
Auth: clickhouse.Auth{
Database: cfg.ClickHouseDB,
Username: cfg.ClickHouseUser,
Password: cfg.ClickHousePassword,
},
Settings: clickhouse.Settings{
"max_execution_time": 60,
},
DialTimeout:     5 * time.Second,
MaxOpenConns:    10,
MaxIdleConns:    5,
ConnMaxLifetime: 10 * time.Minute,
})
if err != nil {
return nil, err
}
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
if err := conn.Ping(ctx); err != nil {
return nil, fmt.Errorf("clickhouse ping: %w", err)
}
return &ClickHouseClient{conn: conn}, nil
}

func (c *ClickHouseClient) InsertEvents(ctx context.Context, events []*model.Event) error {
batch, err := c.conn.PrepareBatch(ctx,
"INSERT INTO sentinel.events (event_id, tenant_id, event_type, timestamp, user_id, session_id, "+
"anonymous_id, ip_address_hash, email_hash, country, city, isp, browser, browser_version, os, "+
"device_type, latency_ms, error_code, status_code, trace_id, span_id, parent_span_id, "+
"service_name, sampling_rate, deployment_env, received_at, ingested_by)")
if err != nil {
return fmt.Errorf("prepare batch: %w", err)
}
for _, ev := range events {
if err := batch.Append(
ev.EventID, ev.TenantID, ev.EventType, ev.Timestamp,
ev.UserID, ev.SessionID, ev.AnonymousID,
ev.IPAddressHash, ev.EmailHash,
ev.Country, ev.City, ev.ISP,
ev.Browser, ev.BrowserVersion, ev.OS, ev.DeviceType,
ev.LatencyMs, ev.ErrorCode, ev.StatusCode,
ev.TraceID, ev.SpanID, ev.ParentSpanID, ev.ServiceName,
ev.SamplingRate, ev.DeploymentEnv,
ev.ReceivedAt, ev.IngestedBy,
); err != nil {
return fmt.Errorf("batch append: %w", err)
}
}
return batch.Send()
}

func (c *ClickHouseClient) GetColumns(ctx context.Context, table string) (map[string]string, error) {
rows, err := c.conn.Query(ctx, "DESCRIBE TABLE "+table)
if err != nil {
return nil, err
}
defer rows.Close()
cols := make(map[string]string)
for rows.Next() {
var name, colType, defaultType, defaultExpr, comment, codecExpr, ttlExpr string
if err := rows.Scan(&name, &colType, &defaultType, &defaultExpr, &comment, &codecExpr, &ttlExpr); err != nil {
continue
}
cols[name] = colType
}
return cols, rows.Err()
}

func (c *ClickHouseClient) AlterTableAddColumn(ctx context.Context, table, column, colType string) error {
query := fmt.Sprintf("ALTER TABLE %s ADD COLUMN IF NOT EXISTS %s %s DEFAULT NULL", table, column, colType)
return c.conn.Exec(ctx, query)
}

func (c *ClickHouseClient) Close() { c.conn.Close() }
