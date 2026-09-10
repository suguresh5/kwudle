# Sentinel — Titan Protocol v2.0

Production-grade real-time observability platform. 100,000+ events/second, sub-second analytical latency, full multi-tenancy, OpenTelemetry native.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Ingest Layer                             │
│  POST /v1/events  │  POST /v1/traces  │  POST /v1/metrics       │
│           Auth → PII Mask → Geo+UA Enrich → Sample → Batch      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ async batcher (10k or 5s)
                    ┌──────▼──────┐
                    │  ClickHouse  │  ReplicatedMergeTree
                    │  (2 nodes +  │  + ClickHouse Keeper
                    │   1 keeper)  │  TTL: 30d→cold, 90d→delete
                    └──────┬──────┘
              ┌────────────┼────────────┐
         ┌────▼────┐  ┌────▼────┐  ┌───▼────┐
         │  Query  │  │ Worker  │  │  Redis  │
         │  API    │  │ (Alert  │  │  Cache  │
         │  :3001  │  │  +DLQ   │  │  :6379  │
         └────┬────┘  │ +Sess.) │  └─────────┘
              │       └─────────┘
         ┌────▼────────────────┐
         │  Next.js Dashboard  │
         │       :3000         │
         └─────────────────────┘
```

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env — set CLICKHOUSE_PASSWORD, REDIS_PASSWORD, PII_HASH_SALT

# 2. Get GeoIP database (free MaxMind account required)
# Place GeoLite2-City.mmdb in ./data/geoip/

# 3. Start all services
docker compose up -d

# 4. Run DDL migrations
./scripts/init.sh

# 5. Provision your first tenant
curl -X POST http://localhost:3001/admin/tenants \
  -H 'Content-Type: application/json' \
  -d '{"name":"My Org","tier":"pro"}'
# Returns: { "tenant_id": "...", "api_key": "sk_..." }

# 6. Send your first event
curl -X POST http://localhost:8080/v1/events \
  -H 'Authorization: Bearer sk_...' \
  -H 'Content-Type: application/json' \
  -d '{
    "event_type": "PageView",
    "user_id": "user_123",
    "ip": "1.2.3.4",
    "email": "user@example.com",
    "latency_ms": 42,
    "deployment_env": "production"
  }'

# 7. Open dashboard
open http://localhost:3000
```

## Features

| Feature | Description |
|---------|-------------|
| **A — PII Masking** | SHA-256 salted hashing of `ip` + `email` at ingestion, with 2ms geo+UA enrichment |
| **B — Batch+Flush** | Async batcher: flush at 10k events or 5s, exponential backoff, DLQ on failure |
| **C — Schema Evolution** | Schemaless-to-structured: auto `ALTER TABLE` with type inference, 1s debounce |
| **D — Session Stitching** | 30-minute gap strategy via `lagInFrame`, runs in sentinel-worker |
| **E — Adaptive Sampling** | Pressure valve at 20k eps: Purchase=100%, PageView=10%, configurable |
| **F — Deployment Overlays** | ASOF JOIN between events + deployments, rendered as chart reference lines |
| **G — Multi-Tenancy** | API key auth, Redis-cached (60s TTL), per-tier rate limits, strict tenant isolation |
| **H — OTel Compatibility** | Native OTLP/HTTP on `:4318/v1/traces` and `:4318/v1/metrics` |
| **I — Alerting Engine** | 60s poll, Slack+PagerDuty webhooks, 5-min re-fire guard |

## Services

| Service | Port | Purpose |
|---------|------|---------|
| `sentinel-dashboard` | 3000 | Next.js UI |
| `sentinel-api` | 3001 | Analytical query API |
| `sentinel-ingest` | 8080, 4317, 4318 | Event + OTel ingestion |
| `sentinel-worker` | 9091 | Alerting + DLQ + Session stitching |
| `clickhouse-01` | 8123, 9000 | Primary ClickHouse node |
| `clickhouse-02` | — | Replica ClickHouse node |
| `clickhouse-keeper` | — | Coordination (replaces ZooKeeper) |
| `redis` | 6379 | Cache + rate limiting |

## API Reference

### Ingestion
```
POST /v1/events          Standard JSON event
POST /v1/traces          OTLP/HTTP traces
POST /v1/metrics         OTLP/HTTP metrics
```

### Analytics
```
GET  /api/stats                         DAU, latency, error rate
GET  /api/stats/sessions                Session explorer
GET  /api/stats/deployments             ASOF JOIN chart data
GET  /api/stats/sampling-status         Current sampling rules
```

### Alerts
```
GET    /api/alerts/rules                List rules
POST   /api/alerts/rules                Create rule
DELETE /api/alerts/rules/:id            Revoke rule
```

### Admin
```
POST   /admin/tenants                   Provision tenant + API key
DELETE /admin/api-keys/:keyHash         Revoke API key
POST   /admin/dlq/replay                Re-ingest failed batches
```

### Self-Observability
```
GET /metrics                            Prometheus format (all services)
GET /health                             Health check (all services)
```

## Engineering Standards

- **No raw SQL concatenation** — all queries use parameterised statements
- **No secrets in code or docker-compose** — `.env` file only
- **Modular architecture** — each feature in its own package/module
- **Structured logging** — JSON lines with `level`, `msg`, `tenant_id`, `trace_id`
- **Self-instrumentation** — ingestion rate, batcher depth, cache hit rate at `/metrics`
