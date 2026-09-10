# Kwudle Observability Architecture & Operations

This document describes the observability infrastructure for the Kwudle real-time observability platform, covering metric collection, alerting, dashboard provisioning, and operational procedures.

---

## 1. Architecture Overview

Kwudle employs a lightweight, production-grade observability stack comprising **Prometheus** (time-series scraping & storage) and **Grafana** (dashboards & visualization). The stack runs alongside the core services on the `sentinel-net` Docker network.

```
┌────────────────────────────────────────────────────────┐
│                   sentinel-net                         │
│                                                        │
│  ┌──────────────────┐          ┌────────────────────┐  │
│  │ sentinel-ingest  │:9090     │  sentinel-worker   │  │:9091
│  │  (/metrics)      │◄──┐      │   (/metrics)       │◄─┼──┐
│  └──────────────────┘   │      └────────────────────┘  │  │
│                         │                              │  │
│  ┌──────────────────┐   │      ┌────────────────────┐  │  │
│  │   sentinel-api   │:3001     │ sentinel-dashboard │  │  │
│  │  (/metrics)      │◄──┼──────┤   (/api/health)    │  │  │
│  └──────────────────┘   │      └────────────────────┘  │  │
│                         │                              │  │
│                         ▼                              │  │
│                  ┌──────────────┐                      │  │
│                  │  Prometheus  │                      │  │
│                  │  (port 9393) │──────────────────────┘  │
│                  └──────┬───────┘                         │
│                         │ (Scrapes every 15s)             │
│                         ▼                                 │
│                  ┌──────────────┐                         │
│                  │   Grafana    │                         │
│                  │  (port 3030) │                         │
│                  └──────────────┘                         │
└────────────────────────────────────────────────────────┘
```

---

## 2. Launching the Observability Stack

The observability stack is defined in `docker-compose.observability.yml` and is designed to compose cleanly on top of the main Kwudle stack:

```bash
# Start main stack with observability extensions
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

### Access Ports
- **Grafana**: [http://localhost:3030](http://localhost:3030)
  - Default Credentials: `admin` / `admin` (or auto-logged in if anonymous auth is configured)
- **Prometheus**: [http://localhost:9393](http://localhost:9393)

---

## 3. Metrics Dictionary

| Metric Name | Type | Emitted By | Description & Guidance |
|-------------|------|------------|------------------------|
| `sentinel_ingest_events_total` | Counter | `sentinel-ingest` | Total raw events received by the HTTP ingest endpoint. Rate of this metric indicates incoming event throughput. |
| `sentinel_ingest_events_dropped_total` | Counter | `sentinel-ingest` | Number of events dropped by the dynamic sampler. `dropped / total` gives sampling drop percentage. |
| `sentinel_batcher_queue_depth` | Gauge | `sentinel-ingest` | Current number of unpersisted events buffered in memory waiting for ClickHouse batch flush. Alert if consistently near channel capacity (50,000). |
| `sentinel_worker_up` | Gauge | `sentinel-worker` | Liveness indicator (always 1 when worker process is running and responding to scrape). |
| `sentinel_dlq_depth` | Gauge | `sentinel-worker` | Number of events stored in the Dead Letter Queue (`dead_letter_queue.log`). Thresholds: Warning > 0, Critical > 100. |
| `sentinel_dlq_oldest_record_age_seconds` | Gauge | `sentinel-worker` | Age of the oldest record in the DLQ. Indicates prolonged failure of downstream or ingest service. |
| `sentinel_sampling_keep_rate` | Gauge | `sentinel-ingest` | Current keep rate ($0.0 - 1.0$) active for each `event_type`. |

---

## 4. Grafana Dashboards

Grafana is pre-configured with declarative provisioning from:
- Datasources: `config/grafana/provisioning/datasources/prometheus.yml`
- Dashboards: `config/grafana/provisioning/dashboards/kwudle.yml`
- Dashboard Definition: `config/grafana/dashboards/kwudle.json`

The **Kwudle Platform Health** dashboard provides:
1. **Ingest Rate (Stat & Graph)**: Events per second across all tenants.
2. **DLQ Backlog (Stat with Color Thresholds)**:
   - Green: `0`
   - Yellow / Warning: `1 - 99`
   - Red / Critical: `≥ 100`
3. **Oldest DLQ Record Age**: Immediate signal if records are sitting unrecovered.
4. **Worker Status**: Single-stat showing cluster daemon liveness.
5. **Sampling Rates by Event Type**: Real-time visibility into dynamic sampler configurations.

---

## 5. Alerting & Webhook Routing

Alert rules are defined in ClickHouse (`sentinel.alert_rules`) and continuously evaluated by `sentinel-worker`:
- Rules evaluate at intervals set by `ALERT_POLL_INTERVAL_S` (default: `60s`).
- Minimum refire suppression is controlled by `ALERT_MIN_REFIRE_S` (default: `300s`).
- Notifications support Slack incoming webhooks, PagerDuty Events API v2, and generic webhook JSON endpoints.
