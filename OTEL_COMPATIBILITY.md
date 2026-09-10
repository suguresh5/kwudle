# Sentinel — OpenTelemetry Compatibility Guide

Sentinel natively accepts OTLP/HTTP payloads (Protobuf + JSON) on two endpoints
that run alongside the standard event ingestion API.

---

## Endpoints

| Method | Path          | Protocol        | Description                      |
|--------|---------------|-----------------|----------------------------------|
| POST   | `/v1/traces`  | OTLP/HTTP JSON  | Receive distributed traces       |
| POST   | `/v1/metrics` | OTLP/HTTP JSON  | Receive metrics data points      |

Both endpoints require the same `Authorization: Bearer <api_key>` header as the
standard `/v1/events` endpoint. All traffic passes through PII masking, the async
batcher, and tenant auth.

---

## Configuring Your OTel SDK

### Node.js / OpenTelemetry JS SDK

```javascript
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');

const traceExporter = new OTLPTraceExporter({
  url: 'http://<sentinel-host>:4318/v1/traces',
  headers: { Authorization: 'Bearer <your_api_key>' },
});

const metricExporter = new OTLPMetricExporter({
  url: 'http://<sentinel-host>:4318/v1/metrics',
  headers: { Authorization: 'Bearer <your_api_key>' },
});
```

### Python / opentelemetry-sdk

```python
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

exporter = OTLPSpanExporter(
    endpoint="http://<sentinel-host>:4318/v1/traces",
    headers={"Authorization": "Bearer <your_api_key>"},
)
```

### Go / otel-go

```go
exporter, err := otlptracehttp.New(ctx,
    otlptracehttp.WithEndpoint("<sentinel-host>:4318"),
    otlptracehttp.WithHeaders(map[string]string{
        "Authorization": "Bearer <your_api_key>",
    }),
    otlptracehttp.WithInsecure(), // remove in production with TLS
)
```

### OpenTelemetry Collector (otel-collector-config.yaml)

```yaml
exporters:
  otlphttp/sentinel:
    endpoint: http://<sentinel-host>:4318
    headers:
      Authorization: "Bearer <your_api_key>"

service:
  pipelines:
    traces:
      exporters: [otlphttp/sentinel]
    metrics:
      exporters: [otlphttp/sentinel]
```

---

## Field Mapping: OTel → Sentinel Schema

### Traces (`/v1/traces`)

| OTel Field                                    | Sentinel Column      | Notes                           |
|-----------------------------------------------|----------------------|---------------------------------|
| `resourceSpans[].resource.attributes`         | top-level event fields (prefixed `resource.`) | Flattened into `properties` |
| `traceId`                                     | `trace_id`           | Dedicated indexed column        |
| `spanId`                                      | `span_id`            | Dedicated indexed column        |
| `parentSpanId`                                | `parent_span_id`     |                                 |
| `status.code` (2 = ERROR)                     | `error_code`         | Set to `"ERROR"` or status message |
| `startTimeUnixNano` / `endTimeUnixNano` delta | `latency_ms`         | Computed at ingestion           |
| `attributes["service.name"]`                  | `service_name`       |                                 |
| `attributes["http.status_code"]`              | `status_code`        |                                 |
| `attributes["http.user_agent"]`               | `RawUserAgent`       | Parsed by UA enricher           |
| `attributes["net.peer.ip"]`                   | `RawIPAddress`       | Hashed by PII masker            |
| All other `attributes`                        | `properties` JSON    | Schemaless overflow             |

### Metrics (`/v1/metrics`)

| OTel Field                              | Sentinel Column   | Notes                              |
|-----------------------------------------|-------------------|------------------------------------|
| `resourceMetrics[].resource.attributes` | `properties`      | Prefixed `resource.`               |
| `metrics[].name`                        | `event_type`      | Formatted as `metric.<name>`       |
| `metrics[].gauge.dataPoints[].asDouble` | `latency_ms`      | Used as the numeric value column   |
| `metrics[].gauge.dataPoints[].timeUnixNano` | `timestamp`   |                                    |
| `dataPoints[].attributes`              | `properties`      | Merged with resource attributes    |

---

## Ports

| Port | Protocol  | Purpose                         |
|------|-----------|---------------------------------|
| 4317 | gRPC      | OTLP/gRPC (future)              |
| 4318 | HTTP      | OTLP/HTTP (JSON + Protobuf)     |
| 8080 | HTTP      | Native Sentinel event ingestion |

---

## Pipeline Flow

All OTel traffic passes through the identical ingestion pipeline:

```
POST /v1/traces or /v1/metrics
  │
  ├─ 1. Auth middleware (Bearer token → tenant_id)
  ├─ 2. OTel normalization (resourceSpans → Event structs)
  ├─ 3. PII masking (ip, email → SHA-256 salted hashes)
  ├─ 4. Geo + UA enrichment (MaxMind + ua-parser, ≤2ms)
  ├─ 5. Adaptive sampling check (Redis sliding window)
  └─ 6. Async batcher → ClickHouse (flush at 10k events or 5s)
```

---

## Querying OTel Data

Traces are stored in `sentinel.events` with `event_type = 'trace.span'`.
Use `trace_id` and `span_id` for point lookups (Bloom filter index applied).

```sql
-- Find all spans for a trace
SELECT span_id, parent_span_id, service_name, latency_ms, error_code, timestamp
FROM sentinel.events
WHERE tenant_id = '<tenant_uuid>'
  AND trace_id = '<trace_id>'
  AND event_type = 'trace.span'
ORDER BY timestamp ASC;

-- P99 latency per service (last 1h)
SELECT service_name, quantile(0.99)(latency_ms) AS p99_ms, count() AS spans
FROM sentinel.events
WHERE tenant_id = '<tenant_uuid>'
  AND event_type = 'trace.span'
  AND timestamp >= now() - INTERVAL 1 HOUR
GROUP BY service_name
ORDER BY p99_ms DESC;
```
