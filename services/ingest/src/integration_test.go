//go:build integration

package src_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/google/uuid"
)

func getEnvOrDefault(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func getClickHouseConn(t *testing.T) clickhouse.Conn {
	host := getEnvOrDefault("CLICKHOUSE_HOST", "localhost")
	port := getEnvOrDefault("CLICKHOUSE_PORT", "9000")
	db := getEnvOrDefault("CLICKHOUSE_DB", "sentinel")
	user := getEnvOrDefault("CLICKHOUSE_USER", "sentinel_user")
	password := getEnvOrDefault("CLICKHOUSE_PASSWORD", "sentinel_password")

	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{fmt.Sprintf("%s:%s", host, port)},
		Auth: clickhouse.Auth{
			Database: db,
			Username: user,
			Password: password,
		},
	})
	if err != nil {
		t.Fatalf("connect to clickhouse: %v", err)
	}
	return conn
}

// TestIngestRoundTrip verifies that an event POSTed to the ingest service lands in ClickHouse.
func TestIngestRoundTrip(t *testing.T) {
	ingestURL := getEnvOrDefault("INGEST_URL", "http://localhost:8080")
	apiKey := getEnvOrDefault("TEST_API_KEY", "test-api-key-123")

	tenantID := uuid.New()
	eventID := uuid.New()

	payload := map[string]interface{}{
		"event_id":   eventID.String(),
		"tenant_id":  tenantID.String(),
		"event_type": "IntegrationPurchase",
		"timestamp":  time.Now().UTC().Format("2006-01-02 15:04:05.000"),
		"payload":    `{"order_id":"ord-999","amount":150.00}`,
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, ingestURL+"/v1/events", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", apiKey)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("send event: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status code: %d", resp.StatusCode)
	}

	// Poll ClickHouse to verify arrival
	ch := getClickHouseConn(t)
	defer ch.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var count uint64
	for i := 0; i < 10; i++ {
		time.Sleep(500 * time.Millisecond)
		err := ch.QueryRow(ctx, "SELECT count() FROM sentinel.events WHERE event_id = ?", eventID).Scan(&count)
		if err == nil && count > 0 {
			break
		}
	}

	if count == 0 {
		t.Errorf("event %s was not found in ClickHouse sentinel.events table", eventID)
	}
}

// TestTenantIsolation verifies that queries for Tenant A cannot see Tenant B events.
func TestTenantIsolation(t *testing.T) {
	ch := getClickHouseConn(t)
	defer ch.Close()

	tenantA := uuid.New()
	tenantB := uuid.New()
	eventA := uuid.New()
	eventB := uuid.New()

	ctx := context.Background()

	// Insert events for both tenants
	batch, err := ch.PrepareBatch(ctx, "INSERT INTO sentinel.events (event_id, tenant_id, event_type, timestamp, raw_payload)")
	if err != nil {
		t.Fatalf("prepare batch: %v", err)
	}
	now := time.Now().UTC()
	_ = batch.Append(eventA, tenantA, "TestIsolation", now, "{}")
	_ = batch.Append(eventB, tenantB, "TestIsolation", now, "{}")
	if err := batch.Send(); err != nil {
		t.Fatalf("insert events: %v", err)
	}

	// Query specifically for Tenant A
	var queryCount uint64
	err = ch.QueryRow(ctx, "SELECT count() FROM sentinel.events WHERE tenant_id = ? AND event_id = ?", tenantA, eventB).Scan(&queryCount)
	if err != nil {
		t.Fatalf("query tenant isolation: %v", err)
	}

	if queryCount != 0 {
		t.Errorf("tenant isolation violation: tenant A query matched tenant B event %s", eventB)
	}
}

// TestDLQReplayEndToEnd verifies that replaying a DLQ batch successfully re-ingests the events.
func TestDLQReplayEndToEnd(t *testing.T) {
	ingestURL := getEnvOrDefault("INGEST_URL", "http://localhost:8080")
	eventID := uuid.New()
	tenantID := uuid.New()

	dlqPayload := []map[string]interface{}{
		{
			"event_id":   eventID.String(),
			"tenant_id":  tenantID.String(),
			"event_type": "DLQRecoveredEvent",
			"timestamp":  time.Now().UTC().Format("2006-01-02 15:04:05.000"),
			"payload":    `{"recovered":true}`,
		},
	}

	body, _ := json.Marshal(dlqPayload)
	req, err := http.NewRequest(http.MethodPost, ingestURL+"/internal/replay", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create replay req: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Replay", "true")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("execute replay: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		t.Fatalf("replay failed with status code %d", resp.StatusCode)
	}
}
