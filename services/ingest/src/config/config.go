package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port    int
	// ClickHouse
	ClickHouseHost     string
	ClickHousePort     int
	ClickHouseUser     string
	ClickHousePassword string
	ClickHouseDB       string
	// Redis
	RedisHost     string
	RedisPort     int
	RedisPassword string
	// PII
	PIIHashSalt string
	// Enrichment
	GeoIPPath           string
	EnrichmentTimeoutMs int64
	// Batcher
	BatcherFlushSize        int
	BatcherFlushIntervalMs  int64
	BatcherRetryInitialMs   int64
	BatcherRetryMaxMs       int64
	BatcherMaxRetries       int
	DLQPath                 string
	// Sampling
	SamplingThreshold int64
	// Schema
	SchemaRefreshIntervalS int
	SchemaDebounceMs       int64
	// Metrics
	MetricsPort int
	// Service
	ServiceName string
}

func Load() *Config {
	return &Config{
		Port:                    envInt("PORT", 8080),
		ClickHouseHost:          envStr("CLICKHOUSE_HOST", "localhost"),
		ClickHousePort:          envInt("CLICKHOUSE_PORT", 9000),
		ClickHouseUser:          envStr("CLICKHOUSE_USER", "sentinel_user"),
		ClickHousePassword:      envStr("CLICKHOUSE_PASSWORD", ""),
		ClickHouseDB:            envStr("CLICKHOUSE_DB", "sentinel"),
		RedisHost:               envStr("REDIS_HOST", "localhost"),
		RedisPort:               envInt("REDIS_PORT", 6379),
		RedisPassword:           envStr("REDIS_PASSWORD", ""),
		PIIHashSalt:             envStr("PII_HASH_SALT", ""),
		GeoIPPath:               envStr("GEOIP_DB_PATH", "/data/geoip/GeoLite2-City.mmdb"),
		EnrichmentTimeoutMs:     envInt64("ENRICHMENT_TIMEOUT_MS", 2),
		BatcherFlushSize:        envInt("BATCHER_FLUSH_SIZE", 10000),
		BatcherFlushIntervalMs:  envInt64("BATCHER_FLUSH_INTERVAL_MS", 5000),
		BatcherRetryInitialMs:   envInt64("BATCHER_RETRY_INITIAL_MS", 500),
		BatcherRetryMaxMs:       envInt64("BATCHER_RETRY_MAX_MS", 30000),
		BatcherMaxRetries:       envInt("BATCHER_MAX_RETRIES", 5),
		DLQPath:                 envStr("DLQ_PATH", "/data/dlq/dead_letter_queue.log"),
		SamplingThreshold:       envInt64("SAMPLING_THRESHOLD", 20000),
		SchemaRefreshIntervalS:  envInt("SCHEMA_REFRESH_INTERVAL_S", 60),
		SchemaDebounceMs:        envInt64("SCHEMA_DEBOUNCE_MS", 1000),
		MetricsPort:             envInt("METRICS_PORT", 9090),
		ServiceName:             envStr("SERVICE_NAME", "sentinel-ingest"),
	}
}

func envStr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return def
}

func envInt64(key string, def int64) int64 {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.ParseInt(v, 10, 64); err == nil {
			return i
		}
	}
	return def
}
