package config

import (
	"os"
	"strconv"
)

type Config struct {
	ClickHouseHost     string
	ClickHousePort     int
	ClickHouseUser     string
	ClickHousePassword string
	ClickHouseDB       string
	RedisHost          string
	RedisPort          int
	RedisPassword      string
	AlertPollIntervalS int
	AlertMinRefireS    int
	DLQPath                string
	IngestReplayURL        string
	DLQMaxAutoRetries      int
	DLQAutoReplayIntervalS int
	SessionStitchIntervalS int
	MetricsPort            int
	ServiceName            string
	DashboardURL           string
	InternalAPIKey         string
	GeminiAPIKey           string
}

func Load() *Config {
	return &Config{
		ClickHouseHost:         envStr("CLICKHOUSE_HOST", "localhost"),
		ClickHousePort:         envInt("CLICKHOUSE_PORT", 9000),
		ClickHouseUser:         envStr("CLICKHOUSE_USER", "sentinel_user"),
		ClickHousePassword:     envStr("CLICKHOUSE_PASSWORD", ""),
		ClickHouseDB:           envStr("CLICKHOUSE_DB", "sentinel"),
		RedisHost:              envStr("REDIS_HOST", "localhost"),
		RedisPort:              envInt("REDIS_PORT", 6379),
		RedisPassword:          envStr("REDIS_PASSWORD", ""),
		AlertPollIntervalS:     envInt("ALERT_POLL_INTERVAL_S", 60),
		AlertMinRefireS:        envInt("ALERT_MIN_REFIRE_S", 300),
		DLQPath:                envStr("DLQ_PATH", "/data/dlq/dead_letter_queue.log"),
		IngestReplayURL:        envStr("INGEST_REPLAY_URL", "http://sentinel-ingest:8080/internal/replay"),
		DLQMaxAutoRetries:      envInt("DLQ_MAX_AUTO_RETRIES", 3),
		DLQAutoReplayIntervalS: envInt("DLQ_AUTO_REPLAY_INTERVAL_S", 300),
		SessionStitchIntervalS: envInt("SESSION_STITCH_INTERVAL_S", 60),
		MetricsPort:            envInt("METRICS_PORT", 9091),
		ServiceName:            envStr("SERVICE_NAME", "sentinel-worker"),
		DashboardURL:           envStr("DASHBOARD_INTERNAL_URL", "http://sentinel-dashboard:3000"),
		InternalAPIKey:         envStr("INTERNAL_API_KEY", ""),
		GeminiAPIKey:           envStr("GEMINI_API_KEY", ""),
	}
}
func envStr(k, d string) string { if v := os.Getenv(k); v != "" { return v }; return d }
func envInt(k string, d int) int {
	if v := os.Getenv(k); v != "" { if i, e := strconv.Atoi(v); e == nil { return i } }
	return d
}
