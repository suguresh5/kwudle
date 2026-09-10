CREATE DATABASE IF NOT EXISTS sentinel;

CREATE TABLE IF NOT EXISTS sentinel.events
(
    event_id         UUID                              DEFAULT generateUUIDv4(),
    tenant_id        UUID,
    event_type       LowCardinality(String),
    timestamp        DateTime64(3, 'UTC'),
    user_id          String,
    session_id       String,
    anonymous_id     String,
    ip_address_hash  String,
    email_hash       String,
    country          LowCardinality(String),
    city             LowCardinality(String),
    isp              LowCardinality(String),
    browser          LowCardinality(String),
    browser_version  LowCardinality(String),
    os               LowCardinality(String),
    device_type      LowCardinality(String),
    latency_ms       Float64,
    error_code       LowCardinality(String),
    status_code      UInt16,
    trace_id         String,
    span_id          String,
    parent_span_id   String,
    service_name     LowCardinality(String),
    sampling_rate    Float64 DEFAULT 1.0,
    deployment_env   LowCardinality(String),
    properties       String,
    received_at      DateTime64(3, 'UTC') DEFAULT now64(3),
    ingested_by      LowCardinality(String)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tenant_id, event_type, timestamp)
TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE;

CREATE TABLE IF NOT EXISTS sentinel.sessions
(
    tenant_id     UUID,
    session_id    String,
    user_id       String,
    session_start DateTime64(3, 'UTC'),
    session_end   DateTime64(3, 'UTC'),
    duration_ms   UInt64,
    page_depth    UInt32,
    event_count   UInt32,
    converted     UInt8 DEFAULT 0,
    entry_page    String,
    exit_page     String,
    country       LowCardinality(String),
    device_type   LowCardinality(String)
)
ENGINE = ReplacingMergeTree(session_end)
PARTITION BY toYYYYMM(session_start)
ORDER BY (tenant_id, user_id, session_id)
TTL toDateTime(session_start) + INTERVAL 90 DAY DELETE;

CREATE TABLE IF NOT EXISTS sentinel.deployments
(
    deployment_id UUID DEFAULT generateUUIDv4(),
    version       String,
    timestamp     DateTime64(3, 'UTC'),
    environment   LowCardinality(String),
    deployed_by   String,
    notes         String
)
ENGINE = MergeTree()
ORDER BY (environment, timestamp);

CREATE TABLE IF NOT EXISTS sentinel.api_keys
(
    key_hash        String,
    tenant_id       UUID,
    name            String,
    rate_limit_tier Enum8('free' = 1, 'pro' = 2, 'enterprise' = 3),
    created_at      DateTime64(3, 'UTC') DEFAULT now64(3),
    revoked         UInt8 DEFAULT 0
)
ENGINE = ReplacingMergeTree(revoked)
ORDER BY (key_hash);

CREATE TABLE IF NOT EXISTS sentinel.alert_rules
(
    id             UUID DEFAULT generateUUIDv4(),
    tenant_id      UUID,
    metric         String,
    operator       Enum8('gt' = 1, 'lt' = 2, 'eq' = 3),
    threshold      Float64,
    window_seconds UInt32,
    notify_channel LowCardinality(String),
    notify_webhook String,
    active         UInt8 DEFAULT 1,
    created_at     DateTime64(3, 'UTC') DEFAULT now64(3),
    last_fired_at  Nullable(DateTime64(3, 'UTC'))
)
ENGINE = ReplacingMergeTree(active)
ORDER BY (tenant_id, id);

CREATE TABLE IF NOT EXISTS sentinel.sampling_rules
(
    id         UUID DEFAULT generateUUIDv4(),
    tenant_id  UUID,
    event_type LowCardinality(String),
    keep_rate  Float64,
    active     UInt8 DEFAULT 1,
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, event_type);

INSERT INTO sentinel.sampling_rules (tenant_id, event_type, keep_rate, active) VALUES (toUUID('00000000-0000-0000-0000-000000000000'), 'Purchase', 1.0, 1), (toUUID('00000000-0000-0000-0000-000000000000'), 'PageView', 0.1, 1), (toUUID('00000000-0000-0000-0000-000000000000'), '*', 0.5, 1);

CREATE TABLE IF NOT EXISTS sentinel.mv_daily_stats_data
(
    tenant_id    UUID,
    event_date   Date,
    event_type   LowCardinality(String),
    environment  LowCardinality(String),
    dau          AggregateFunction(uniq, String),
    total_events AggregateFunction(count),
    p50_state    AggregateFunction(quantile(0.50), Float64),
    p95_state    AggregateFunction(quantile(0.95), Float64),
    p99_state    AggregateFunction(quantile(0.99), Float64),
    error_count  AggregateFunction(sum, UInt64)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, event_date, event_type, environment);

CREATE MATERIALIZED VIEW IF NOT EXISTS sentinel.mv_daily_stats
TO sentinel.mv_daily_stats_data AS
SELECT
    tenant_id,
    toDate(timestamp)               AS event_date,
    event_type,
    deployment_env                  AS environment,
    uniqState(user_id)              AS dau,
    countState()                    AS total_events,
    quantileState(0.50)(latency_ms) AS p50_state,
    quantileState(0.95)(latency_ms) AS p95_state,
    quantileState(0.99)(latency_ms) AS p99_state,
    sumState(toUInt64(status_code >= 400 OR error_code != '')) AS error_count
FROM sentinel.events
GROUP BY tenant_id, event_date, event_type, environment;

CREATE TABLE IF NOT EXISTS sentinel.mv_error_rate_data
(
    tenant_id     UUID,
    minute_bucket DateTime('UTC'),
    environment   LowCardinality(String),
    service_name  LowCardinality(String),
    total_events  AggregateFunction(count),
    error_events  AggregateFunction(sum, UInt64),
    p99_state     AggregateFunction(quantile(0.99), Float64)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(minute_bucket)
ORDER BY (tenant_id, minute_bucket, environment, service_name);

CREATE MATERIALIZED VIEW IF NOT EXISTS sentinel.mv_error_rate_per_minute
TO sentinel.mv_error_rate_data AS
SELECT
    tenant_id,
    toStartOfMinute(timestamp)      AS minute_bucket,
    deployment_env                  AS environment,
    service_name,
    countState()                    AS total_events,
    sumState(toUInt64(status_code >= 400 OR error_code != '')) AS error_events,
    quantileState(0.99)(latency_ms) AS p99_state
FROM sentinel.events
GROUP BY tenant_id, minute_bucket, environment, service_name;

-- ─── Feature 1: Logs Explorer ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sentinel.logs
(
    timestamp   DateTime DEFAULT now(),
    level       LowCardinality(String),
    service     LowCardinality(String),
    message     String,
    details     String,
    tenant_id   UUID,
    request_id  String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tenant_id, timestamp, level)
TTL timestamp + INTERVAL 30 DAY;

-- ─── Feature 2: AI Improvement Suggestions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS sentinel.suggestions
(
    id              UUID DEFAULT generateUUIDv4(),
    tenant_id       UUID,
    generated_at    DateTime DEFAULT now(),
    category        LowCardinality(String),
    priority        LowCardinality(String),
    title           String,
    problem         String,
    suggestion      String,
    expected_impact String,
    data_evidence   String,
    status          LowCardinality(String) DEFAULT 'active'
)
ENGINE = MergeTree()
ORDER BY (tenant_id, generated_at, priority)
TTL generated_at + INTERVAL 90 DAY;


-- ══════════════════════════════════════════════════════════════
--  TABLE: sentinel.dashboard_users  (dashboard login + onboarding)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sentinel.dashboard_users
(
    email                   String,
    name                    String DEFAULT '',
    password_hash           String DEFAULT '',
    business_setup_complete UInt8  DEFAULT 0,
    business_type           LowCardinality(String) DEFAULT '',
    created_at              DateTime64(3,'UTC') DEFAULT now64(3),
    updated_at              DateTime64(3,'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (email)
PRIMARY KEY (email)
SETTINGS index_granularity = 8192;
