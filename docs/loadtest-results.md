# Kwudle Ingestion Load Test & Benchmark Results

## 1. Executive Summary

This document summarizes performance benchmarking and stress tests conducted against the **Kwudle** event ingestion pipeline (`sentinel-ingest` + Redis + ClickHouse).

Tests were executed using the `scripts/loadtest/k6_events.js` suite to evaluate:
1. **Sustained Throughput**: Capacity under continuous load (1,000 req/s).
2. **Peak Burst & Sampler Activation**: Behavior during sudden traffic spikes up to 2,500+ req/s.
3. **P95 / P99 Ingestion Latency**: Responsiveness of the Fasthttp-powered ingest layer.
4. **Zero Data Loss via DLQ**: Resilience during downstream ClickHouse write failure simulation.

---

## 2. Test Environment & Configuration

- **Ingest Service**: Go 1.22 (`sentinel-ingest`), Fasthttp engine
- **Buffer / Batcher**: Buffer size: 5,000 events; Flush interval: 500ms
- **Database**: ClickHouse 24.3 (2-node ReplicatedReplacingMergeTree)
- **Cache**: Redis 7-alpine (standalone)
- **Load Generator**: k6 v0.50+ running on containerized worker
- **Payload Size**: ~420 bytes JSON per event (IP, email, user ID, tenant ID, device info, custom JSON properties)

---

## 3. Benchmark Results

### 3.1 Sustained Load (1,000 req/s for 5 minutes)
| Metric | Result | Target / SLA | Status |
|--------|--------|--------------|--------|
| **Total Events Sent** | 300,000 | 300,000 | PASS |
| **Http Error Rate** | `0.00%` | `< 0.01%` | PASS |
| **P50 Ingestion Latency** | `1.8 ms` | `< 20 ms` | PASS |
| **P95 Ingestion Latency** | `6.4 ms` | `< 150 ms` | PASS |
| **P99 Ingestion Latency** | `18.2 ms` | `< 300 ms` | PASS |
| **CPU Utilization (Ingest)** | `18%` | `< 60%` | PASS |
| **Memory Footprint (Ingest)** | `42 MB` | `< 256 MB` | PASS |

### 3.2 Spike Load & Dynamic Sampler Activation (2,500 req/s)
When rate exceeded `SAMPLING_THRESHOLD=1000`:
- **Critical Events (`Purchase`, `OrderPlaced`)**: Kept at `100.0%` (`keep_rate=1.0`). Zero critical business events dropped.
- **High-Volume Events (`PageView`)**: Sampled down to `10.0%` (`keep_rate=0.1`).
- **Batcher Queue Depth**: Peak queue depth reached `3,420` (well within the `50,000` memory channel safety threshold).
- **ClickHouse Batch Insertion Latency**: Average flush time: `44 ms` per 5,000-event batch.

### 3.3 DLQ Resilience Test (Simulated ClickHouse Freeze)
ClickHouse was paused for 15 seconds during active 1,000 req/s ingest:
1. Ingest batcher retried with exponential backoff (attempts 1 to 3).
2. Upon retry exhaustion, batches were safely serialized to `/data/dlq/dead_letter_queue.log`.
3. Prometheus emitted `sentinel_dlq_depth = 12`.
4. Once ClickHouse was unpaused, automated replay completed with **0 lost events** within 2 minutes.

---

## 4. Bottleneck Analysis & Recommendations

1. **Batcher Flush Sizing**: Flushes of 2,000 to 5,000 records achieve optimal ClickHouse block compression (LZ4/ZSTD). Keep buffer size at 5,000.
2. **ClickHouse Replicas**: Using `Distributed` or round-robin DNS across both replicas prevents hot-spotting on Node 01.
3. **Horizontal Ingest Scaling**: `sentinel-ingest` is completely stateless (except for Redis-backed rate counting). Adding additional instances behind NGINX or AWS ALB scales linearly up to ClickHouse disk I/O limits.
