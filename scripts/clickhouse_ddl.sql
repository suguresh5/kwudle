-- ══════════════════════════════════════════════════════════════════════════════
--  Sentinel — Titan Protocol  |  ClickHouse DDL  v2.0
--  Run via:  clickhouse-client --host clickhouse-01 < clickhouse_ddl.sql
-- ══════════════════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS sentinel ON CLUSTER '{cluster}';

-- ══════════════════════════════════════════════════════════════
--  TABLE: sentinel.events  (primary event store)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sentinel.events ON CLUSTER '{cluster}'
(
    event_id         UUID                              CODEC(ZSTD(3)),
    tenant_id        UUID                              CODEC(ZSTD(3)),
    event_type       LowCardinality(String)            CODEC(ZSTD(3)),
    timestamp        DateTime64(3, 'UTC')              CODEC(DoubleDelta, ZSTD(3)),

    -- User identity
    user_id          String                            CODEC(ZSTD(3)),
    session_id       UUID                              CODEC(ZSTD(3)),
    anonymous_id     String                            CODEC(ZSTD(3)),

    -- PII hashed at ingestion (SHA-256 + salt)
    ip_address_hash  String                            CODEC(ZSTD(3)),
    email_hash       String                            CODEC(ZSTD(3)),

    -- Geo (MaxMind GeoIP Lite)
    country          LowCardinality(String)            CODEC(ZSTD(3)),
    city             LowCardinality(String)            CODEC(ZSTD(3)),
    isp              LowCardinality(String)            CODEC(ZSTD(3)),

    -- UA decomposition
    browser          LowCardinality(String)            CODEC(ZSTD(3)),
    browser_version  LowCardinality(String)            CODEC(ZSTD(3)),
    os               LowCardinality(String)            CODEC(ZSTD(3)),
    device_type      LowCardinality(String)            CODEC(ZSTD(3)),

    -- Observability
    latency_ms       Float64                           CODEC(Gorilla, ZSTD(3)),
    error_code       LowCardinality(String)            CODEC(ZSTD(3)),
    status_code      UInt16                            CODEC(T64, ZSTD(3)),

    -- OTel (Feature H)
    trace_id         String                            CODEC(ZSTD(3)),
    span_id          String                            CODEC(ZSTD(3)),
    parent_span_id   String                            CODEC(ZSTD(3)),
    service_name     LowCardinality(String)            CODEC(ZSTD(3)),

    -- Adaptive sampling (Feature E)
    sampling_rate    Float64 DEFAULT 1.0               CODEC(Gorilla, ZSTD(3)),

    -- Deployment context
    deployment_env   LowCardinality(String)            CODEC(ZSTD(3)),

    -- Schemaless overflow (JSON string)
    properties       String                            CODEC(ZSTD(3)),

    -- Ingest metadata
    received_at      DateTime64(3, 'UTC') DEFAULT now64(3) CODEC(DoubleDelta, ZSTD(3)),
    ingested_by      LowCardinality(String)            CODEC(ZSTD(3))
)
ENGINE = ReplicatedMergeTree(
    '/clickhouse/tables/{shard}/sentinel.events',
    '{replica}'
)
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tenant_id, event_type, timestamp)
PRIMARY KEY (tenant_id, event_type, timestamp)
SETTINGS index_granularity = 8192
TTL
    timestamp + INTERVAL 30 DAY TO DISK 'cold_storage',
    timestamp + INTERVAL 90 DAY DELETE;

-- Bloom filter on trace_id for point lookups
ALTER TABLE sentinel.events ON CLUSTER '{cluster}'
    ADD INDEX idx_trace_id   (trace_id)   TYPE bloom_filter(0.01) GRANULARITY 4,
    ADD INDEX idx_user_id    (user_id)    TYPE bloom_filter(0.01) GRANULARITY 4,
    ADD INDEX idx_session_id (session_id) TYPE bloom_filter(0.01) GRANULARITY 4;

-- ══════════════════════════════════════════════════════════════
--  TABLE: sentinel.sessions  (session stitching output)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sentinel.sessions ON CLUSTER '{cluster}'
(
    tenant_id     UUID                   CODEC(ZSTD(3)),
    session_id    UUID                   CODEC(ZSTD(3)),
    user_id       String                 CODEC(ZSTD(3)),
    session_start DateTime64(3, 'UTC')   CODEC(DoubleDelta, ZSTD(3)),
    session_end   DateTime64(3, 'UTC')   CODEC(DoubleDelta, ZSTD(3)),
    duration_ms   UInt64                 CODEC(T64, ZSTD(3)),
    page_depth    UInt32                 CODEC(T64, ZSTD(3)),
    event_count   UInt32                 CODEC(T64, ZSTD(3)),
    converted     UInt8 DEFAULT 0        CODEC(T64, ZSTD(3)),
    entry_page    String                 CODEC(ZSTD(3)),
    exit_page     String                 CODEC(ZSTD(3)),
    country       LowCardinality(String) CODEC(ZSTD(3)),
    device_type   LowCardinality(String) CODEC(ZSTD(3))
)
ENGINE = ReplicatedReplacingMergeTree(
    '/clickhouse/tables/{shard}/sentinel.sessions',
    '{replica}',
    session_end
)
PARTITION BY toYYYYMM(session_start)
ORDER BY (tenant_id, user_id, session_id)
PRIMARY KEY (tenant_id, user_id, session_id)
SETTINGS index_granularity = 8192
TTL
    session_start + INTERVAL 30 DAY TO DISK 'cold_storage',
    session_start + INTERVAL 90 DAY DELETE;

-- ══════════════════════════════════════════════════════════════
--  TABLE: sentinel.deployments  (Feature F - deployment markers)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sentinel.deployments ON CLUSTER '{cluster}'
(
    deployment_id UUID                            CODEC(ZSTD(3)),
    version       String                          CODEC(ZSTD(3)),
    timestamp     DateTime64(3, 'UTC')            CODEC(DoubleDelta, ZSTD(3)),
    environment   LowCardinality(String)          CODEC(ZSTD(3)),
    deployed_by   String                          CODEC(ZSTD(3)),
    notes         String                          CODEC(ZSTD(3))
)
ENGINE = ReplicatedMergeTree(
    '/clickhouse/tables/{shard}/sentinel.deployments',
    '{replica}'
)
PARTITION BY toYYYY(timestamp)
ORDER BY (environment, timestamp)
PRIMARY KEY (environment, timestamp)
SETTINGS index_granularity = 8192;

-- ══════════════════════════════════════════════════════════════
--  TABLE: sentinel.api_keys  (Feature G - auth + tenancy)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sentinel.api_keys ON CLUSTER '{cluster}'
(
    key_hash        String                                           CODEC(ZSTD(3)),
    tenant_id       UUID                                             CODEC(ZSTD(3)),
    name            String                                           CODEC(ZSTD(3)),
    rate_limit_tier Enum8('free' = 1, 'pro' = 2, 'enterprise' = 3)  CODEC(ZSTD(3)),
    created_at      DateTime64(3, 'UTC')                             CODEC(DoubleDelta, ZSTD(3)),
    revoked         UInt8 DEFAULT 0                                  CODEC(T64, ZSTD(3))
)
ENGINE = ReplicatedReplacingMergeTree(
    '/clickhouse/tables/{shard}/sentinel.api_keys',
    '{replica}',
    revoked
)
ORDER BY (key_hash)
PRIMARY KEY (key_hash)
SETTINGS index_granularity = 8192;

-- ══════════════════════════════════════════════════════════════
--  TABLE: sentinel.alert_rules  (Feature I)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sentinel.alert_rules ON CLUSTER '{cluster}'
(
    id             UUID                                         CODEC(ZSTD(3)),
    tenant_id      UUID                                         CODEC(ZSTD(3)),
    metric         String                                       CODEC(ZSTD(3)),
    operator       Enum8('gt' = 1, 'lt' = 2, 'eq' = 3)        CODEC(ZSTD(3)),
    threshold      Float64                                      CODEC(Gorilla, ZSTD(3)),
    window_seconds UInt32                                       CODEC(T64, ZSTD(3)),
    notify_channel LowCardinality(String)                       CODEC(ZSTD(3)),
    notify_webhook String                                       CODEC(ZSTD(3)),
    active         UInt8 DEFAULT 1                              CODEC(T64, ZSTD(3)),
    created_at     DateTime64(3, 'UTC') DEFAULT now64(3)        CODEC(DoubleDelta, ZSTD(3)),
    last_fired_at  Nullable(DateTime64(3, 'UTC'))               CODEC(DoubleDelta, ZSTD(3))
)
ENGINE = ReplicatedReplacingMergeTree(
    '/clickhouse/tables/{shard}/sentinel.alert_rules',
    '{replica}',
    active
)
ORDER BY (tenant_id, id)
PRIMARY KEY (tenant_id, id)
SETTINGS index_granularity = 8192;

-- ══════════════════════════════════════════════════════════════
--  TABLE: sentinel.sampling_rules  (Feature E)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sentinel.sampling_rules ON CLUSTER '{cluster}'
(
    id         UUID                            CODEC(ZSTD(3)),
    tenant_id  UUID                            CODEC(ZSTD(3)),
    event_type LowCardinality(String)          CODEC(ZSTD(3)),
    keep_rate  Float64                         CODEC(Gorilla, ZSTD(3)),
    active     UInt8 DEFAULT 1                 CODEC(T64, ZSTD(3)),
    updated_at DateTime64(3, 'UTC')            CODEC(DoubleDelta, ZSTD(3))
)
ENGINE = ReplicatedReplacingMergeTree(
    '/clickhouse/tables/{shard}/sentinel.sampling_rules',
    '{replica}',
    updated_at
)
ORDER BY (tenant_id, event_type)
PRIMARY KEY (tenant_id, event_type)
SETTINGS index_granularity = 8192;

-- Global defaults (tenant_id = nil UUID = system default)
INSERT INTO sentinel.sampling_rules VALUES
    (generateUUIDv4(), '00000000-0000-0000-0000-000000000000', 'Purchase', 1.0, 1, now64(3)),
    (generateUUIDv4(), '00000000-0000-0000-0000-000000000000', 'PageView',  0.1, 1, now64(3)),
    (generateUUIDv4(), '00000000-0000-0000-0000-000000000000', '*',         0.5, 1, now64(3));

-- ══════════════════════════════════════════════════════════════
--  MV 1: mv_daily_stats  (DAU + latency percentiles per day)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sentinel.mv_daily_stats_data ON CLUSTER '{cluster}'
(
    tenant_id         UUID                                              CODEC(ZSTD(3)),
    event_date        Date                                              CODEC(DoubleDelta, ZSTD(3)),
    event_type        LowCardinality(String)                            CODEC(ZSTD(3)),
    environment       LowCardinality(String)                            CODEC(ZSTD(3)),
    dau               AggregateFunction(uniq, String)                   CODEC(ZSTD(3)),
    total_events      AggregateFunction(count)                          CODEC(ZSTD(3)),
    p50_state         AggregateFunction(quantile(0.50), Float64)        CODEC(ZSTD(3)),
    p95_state         AggregateFunction(quantile(0.95), Float64)        CODEC(ZSTD(3)),
    p99_state         AggregateFunction(quantile(0.99), Float64)        CODEC(ZSTD(3)),
    error_count       AggregateFunction(sum, UInt64)                    CODEC(ZSTD(3))
)
ENGINE = ReplicatedAggregatingMergeTree(
    '/clickhouse/tables/{shard}/sentinel.mv_daily_stats_data',
    '{replica}'
)
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, event_date, event_type, environment)
TTL
    event_date + INTERVAL 30 DAY TO DISK 'cold_storage',
    event_date + INTERVAL 90 DAY DELETE;

CREATE MATERIALIZED VIEW IF NOT EXISTS sentinel.mv_daily_stats
ON CLUSTER '{cluster}'
TO sentinel.mv_daily_stats_data AS
SELECT
    tenant_id,
    toDate(timestamp)                         AS event_date,
    event_type,
    deployment_env                            AS environment,
    uniqState(user_id)                        AS dau,
    countState()                              AS total_events,
    quantileState(0.50)(latency_ms)           AS p50_state,
    quantileState(0.95)(latency_ms)           AS p95_state,
    quantileState(0.99)(latency_ms)           AS p99_state,
    sumState(toUInt64(status_code >= 400 OR error_code != '')) AS error_count
FROM sentinel.events
GROUP BY tenant_id, event_date, event_type, environment;

-- ══════════════════════════════════════════════════════════════
--  MV 2: mv_session_stitching  (raw session boundary feed)
--  Full lagInFrame stitching runs in sentinel-worker (window
--  functions are not supported inside ClickHouse MVs).
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sentinel.mv_session_feed_data ON CLUSTER '{cluster}'
(
    tenant_id   UUID                    CODEC(ZSTD(3)),
    user_id     String                  CODEC(ZSTD(3)),
    event_id    UUID                    CODEC(ZSTD(3)),
    timestamp   DateTime64(3, 'UTC')    CODEC(DoubleDelta, ZSTD(3)),
    event_type  LowCardinality(String)  CODEC(ZSTD(3)),
    country     LowCardinality(String)  CODEC(ZSTD(3)),
    device_type LowCardinality(String)  CODEC(ZSTD(3)),
    properties  String                  CODEC(ZSTD(3))
)
ENGINE = ReplicatedMergeTree(
    '/clickhouse/tables/{shard}/sentinel.mv_session_feed_data',
    '{replica}'
)
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tenant_id, user_id, timestamp)
TTL
    timestamp + INTERVAL 7 DAY DELETE;  -- short-lived feed consumed by worker

CREATE MATERIALIZED VIEW IF NOT EXISTS sentinel.mv_session_stitching
ON CLUSTER '{cluster}'
TO sentinel.mv_session_feed_data AS
SELECT
    tenant_id,
    user_id,
    event_id,
    timestamp,
    event_type,
    country,
    device_type,
    properties
FROM sentinel.events;

-- ══════════════════════════════════════════════════════════════
--  MV 3: mv_error_rate_per_minute  (powers alerting engine)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sentinel.mv_error_rate_data ON CLUSTER '{cluster}'
(
    tenant_id       UUID                                         CODEC(ZSTD(3)),
    minute_bucket   DateTime('UTC')                              CODEC(DoubleDelta, ZSTD(3)),
    environment     LowCardinality(String)                       CODEC(ZSTD(3)),
    service_name    LowCardinality(String)                       CODEC(ZSTD(3)),
    total_events    AggregateFunction(count)                     CODEC(ZSTD(3)),
    error_events    AggregateFunction(sum, UInt64)               CODEC(ZSTD(3)),
    p99_state       AggregateFunction(quantile(0.99), Float64)   CODEC(ZSTD(3))
)
ENGINE = ReplicatedAggregatingMergeTree(
    '/clickhouse/tables/{shard}/sentinel.mv_error_rate_data',
    '{replica}'
)
PARTITION BY toYYYYMM(minute_bucket)
ORDER BY (tenant_id, minute_bucket, environment, service_name)
TTL
    minute_bucket + INTERVAL 30 DAY TO DISK 'cold_storage',
    minute_bucket + INTERVAL 90 DAY DELETE;

CREATE MATERIALIZED VIEW IF NOT EXISTS sentinel.mv_error_rate_per_minute
ON CLUSTER '{cluster}'
TO sentinel.mv_error_rate_data AS
SELECT
    tenant_id,
    toStartOfMinute(timestamp)            AS minute_bucket,
    deployment_env                        AS environment,
    service_name,
    countState()                          AS total_events,
    sumState(toUInt64(status_code >= 400 OR error_code != '')) AS error_events,
    quantileState(0.99)(latency_ms)       AS p99_state
FROM sentinel.events
GROUP BY tenant_id, minute_bucket, environment, service_name;

-- ══════════════════════════════════════════════════════════════
--  TABLE: sentinel.dashboard_users  (dashboard login + onboarding)
--  ReplicatedReplacingMergeTree so user updates survive restarts
--  and replicate across the 2-node pair.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sentinel.dashboard_users ON CLUSTER '{cluster}'
(
    email                   String                  CODEC(ZSTD(3)),
    name                    String                  CODEC(ZSTD(3)),
    password_hash           String                  CODEC(ZSTD(3)),
    business_setup_complete UInt8  DEFAULT 0        CODEC(T64, ZSTD(3)),
    business_type           LowCardinality(String)  CODEC(ZSTD(3)),
    created_at              DateTime64(3,'UTC') DEFAULT now64(3) CODEC(DoubleDelta, ZSTD(3)),
    updated_at              DateTime64(3,'UTC') DEFAULT now64(3) CODEC(DoubleDelta, ZSTD(3))
)
ENGINE = ReplicatedReplacingMergeTree(
    '/clickhouse/tables/{shard}/sentinel.dashboard_users',
    '{replica}',
    updated_at
)
ORDER BY (email)
PRIMARY KEY (email)
SETTINGS index_granularity = 8192;

