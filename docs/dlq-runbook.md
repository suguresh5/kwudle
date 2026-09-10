# Kwudle Dead Letter Queue (DLQ) Operational Runbook

## 1. Overview & Architecture

Kwudle uses a Dead Letter Queue (DLQ) to ensure zero data loss during downstream outages (such as ClickHouse cluster unreachability, network partition, or disk saturation).

When `sentinel-ingest` exhausts its internal flush retries against ClickHouse, unwritten event batches are safely serialized to disk in NDJSON format:
- **Default Path**: `/data/dlq/dead_letter_queue.log`
- **Format**: One JSON object per line:
  ```json
  {
    "failed_at": "2026-09-08T10:30:00Z",
    "retry_reason": "clickhouse connection refused",
    "batch_size": 250,
    "events": [
      {
        "event_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "tenant_id": "00000000-0000-0000-0000-000000000001",
        "event_type": "Purchase",
        "timestamp": "2026-09-08 10:29:58.123",
        "payload": "{\"amount\":99.95}"
      }
    ]
  }
  ```

---

## 2. DLQ Metrics & Thresholds

The `sentinel-worker` service scans the DLQ log and exposes metrics via Prometheus on `:9091/metrics`:

| Metric | Type | Description | Warning Threshold | Critical Threshold |
|--------|------|-------------|-------------------|--------------------|
| `sentinel_dlq_depth` | Gauge | Number of failed batches waiting in DLQ | `> 0` | `> 100` |
| `sentinel_dlq_oldest_record_age_seconds` | Gauge | Seconds since oldest record failed | `> 600` (10m) | `> 3600` (1h) |

### Built-in Alert Rule
Kwudle automatically seeds a system alert rule in ClickHouse:
- Metric: `dlq_depth`
- Operator: `gt`
- Threshold: `100`
- Window: `300s` (5 minutes)
- Action: Dispatches alert to Slack / PagerDuty / configured webhook

---

## 3. Automated Replay Mechanism

`sentinel-worker` includes an automated DLQ replay worker:
- **Interval**: Runs every 5 minutes (`DLQ_AUTO_REPLAY_INTERVAL_S=300`).
- **Target Endpoint**: `http://sentinel-ingest:8080/internal/replay`.
- **Atomic File Updates**: Successfully replayed batches are stripped from the DLQ file; only failing batches remain.
- **Exponential Backoff**: If a replay attempt fails or experiences partial errors, consecutive failures are incremented, and the worker backs off exponentially ($2^{\text{failures}}$ minutes), up to `DLQ_MAX_AUTO_RETRIES` (default: 3).

---

## 4. Manual Replay Procedures

If automated replay is paused or an on-call engineer wants to trigger immediate reprocessing after fixing an infrastructure incident:

### Option A: Via Sentinel API Gateway (Recommended)
```bash
curl -X POST http://localhost:3001/admin/dlq/replay \
  -H "X-API-Key: <YOUR_ADMIN_API_KEY>"
```

### Option B: Directly to Worker
```bash
curl -X POST http://localhost:9091/admin/dlq/replay
```

### Option C: Trigger from Ingest Container
```bash
docker exec -it sentinel-worker curl -X POST http://localhost:9091/admin/dlq/replay
```

### Expected Output
```json
{
  "succeeded": 15,
  "failed": 0
}
```

---

## 5. Troubleshooting & Incident Response

### Step 1: Check Downstream Health
Verify that ClickHouse is healthy and accepting writes:
```bash
docker exec -it sentinel-clickhouse-01 clickhouse-client --query "SELECT 1"
```

### Step 2: Inspect DLQ Log Contents
Examine the recent failures to identify the root cause:
```bash
# View last 5 lines in DLQ
docker exec -it sentinel-worker tail -n 5 /data/dlq/dead_letter_queue.log | jq .
```
Common root causes:
- `Connection refused`: ClickHouse container is down or restarting.
- `Memory limit exceeded`: ClickHouse memory cap reached during heavy merge; check server memory settings.
- `Table schema mismatch`: An unmigrated schema is rejecting new fields.

### Step 3: Trigger Manual Replay
Once ClickHouse is verified healthy:
```bash
curl -X POST http://localhost:3001/admin/dlq/replay
```

### Step 4: Verify Metric Recovery
Check Prometheus or the Grafana dashboard at `http://localhost:3030`:
- `sentinel_dlq_depth` should drop to `0`.
- `sentinel_dlq_oldest_record_age_seconds` should reset to `0.0`.
