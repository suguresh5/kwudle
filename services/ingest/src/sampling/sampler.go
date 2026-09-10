package sampling

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sentinel/ingest/src/config"
	"github.com/sentinel/ingest/src/model"
)

const (
	rateCounterKey      = "sentinel:ingest:rate"
	rateWindowS         = 1
	samplingRulesTTL    = 60 * time.Second
	refreshInterval     = 30 * time.Second
	samplingRuleKeyFmt  = "sampling_rules:%s:%s" // tenant_id:event_type
	samplingRuleWildFmt = "sampling_rules:%s:*"  // tenant_id:*
)

// ruleRow mirrors a row from sentinel.sampling_rules
type ruleRow struct {
	TenantID  string  `json:"tenant_id"`
	EventType string  `json:"event_type"`
	KeepRate  float64 `json:"keep_rate"`
	Active    uint8   `json:"active"`
}

// Sampler decides whether an event should be kept under load.
// It tracks the rolling ingestion rate using a Redis 1-second counter.
// When under pressure, it resolves keep-rates from Redis (cached from ClickHouse)
// with hard-coded defaults as the last resort.
type Sampler struct {
	redis     *redis.Client
	cfg       *config.Config
	threshold int64
	chHTTP    *http.Client // for ClickHouse HTTP API reads (port 8123)
}

func NewSampler(r *redis.Client, cfg *config.Config) *Sampler {
	s := &Sampler{
		redis:     r,
		cfg:       cfg,
		threshold: cfg.SamplingThreshold,
		chHTTP:    &http.Client{Timeout: 5 * time.Second},
	}
	// Background goroutine: refresh all tenant sampling rules into Redis every 30s
	go s.refreshLoop(context.Background())
	return s
}

// ShouldKeep returns (keep bool, samplingRate float64).
// It increments the rolling counter on every call. When the rate exceeds
// the threshold it applies per-event-type sampling rules from Redis/ClickHouse.
func (s *Sampler) ShouldKeep(ctx context.Context, event *model.Event) (bool, float64) {
	rate := s.incrementRate(ctx)
	if rate <= s.threshold {
		event.SamplingRate = 1.0
		return true, 1.0
	}

	keepRate := s.keepRate(ctx, event.TenantID, event.EventType)
	event.SamplingRate = keepRate

	if keepRate >= 1.0 {
		return true, 1.0
	}
	keep := rand.Float64() < keepRate
	return keep, keepRate
}

// keepRate resolves the sampling keep-rate for a given (tenantID, eventType).
// Resolution order:
//  1. Redis cache key "sampling_rules:{tenantID}:{eventType}"
//  2. Redis cache key "sampling_rules:{tenantID}:*"   (wildcard/default)
//  3. ClickHouse direct query (populates Redis cache)
//  4. Hard-coded defaults: Purchase=1.0, PageView=0.1, *=0.5
func (s *Sampler) keepRate(ctx context.Context, tenantID, eventType string) float64 {
	if s.redis != nil {
		// 1. Specific rule from Redis
		specificKey := fmt.Sprintf(samplingRuleKeyFmt, tenantID, eventType)
		if v, err := s.redis.Get(ctx, specificKey).Float64(); err == nil {
			return v
		}

		// 2. Wildcard rule from Redis
		wildcardKey := fmt.Sprintf(samplingRuleKeyFmt, tenantID, "*")
		if v, err := s.redis.Get(ctx, wildcardKey).Float64(); err == nil {
			return v
		}
	}

	// 3. ClickHouse fallback (synchronous, only hits when cache is cold)
	if rules, err := s.queryRulesFromCH(ctx, tenantID); err == nil {
		s.cacheRules(ctx, rules)
		for _, r := range rules {
			if r.EventType == eventType && r.Active == 1 {
				return r.KeepRate
			}
		}
		for _, r := range rules {
			if r.EventType == "*" && r.Active == 1 {
				return r.KeepRate
			}
		}
	} else {
		slog.Warn("sampling: CH fallback failed", "tenant_id", tenantID, "error", err)
	}

	// 4. Hard-coded defaults
	return hardcodedDefault(eventType)
}

// RefreshRules queries all active sampling rules from ClickHouse and caches them in Redis.
// Called periodically by the background goroutine.
func (s *Sampler) RefreshRules(ctx context.Context) {
	// Global wildcard tenant (all tenants share tenant_id 00000000-...)
	query := `SELECT tenant_id, event_type, keep_rate, active
FROM sentinel.sampling_rules
WHERE active = 1
FORMAT JSONEachRow`

	rules, err := s.queryWithSQL(ctx, query)
	if err != nil {
		slog.Warn("sampling: refresh failed", "error", err)
		return
	}
	s.cacheRules(ctx, rules)
	slog.Debug("sampling: rules refreshed", "count", len(rules))
}

func (s *Sampler) refreshLoop(ctx context.Context) {
	ticker := time.NewTicker(refreshInterval)
	defer ticker.Stop()
	// Eager first load
	s.RefreshRules(ctx)
	for {
		select {
		case <-ticker.C:
			s.RefreshRules(ctx)
		case <-ctx.Done():
			return
		}
	}
}

// cacheRules writes rule keep-rates into Redis with TTL.
func (s *Sampler) cacheRules(ctx context.Context, rules []ruleRow) {
	pipe := s.redis.Pipeline()
	for _, r := range rules {
		if r.Active != 1 {
			continue
		}
		key := fmt.Sprintf(samplingRuleKeyFmt, r.TenantID, r.EventType)
		pipe.Set(ctx, key, r.KeepRate, samplingRulesTTL)
	}
	if _, err := pipe.Exec(ctx); err != nil {
		slog.Warn("sampling: redis cache write error", "error", err)
	}
}

func (s *Sampler) queryRulesFromCH(ctx context.Context, tenantID string) ([]ruleRow, error) {
	query := fmt.Sprintf(
		`SELECT tenant_id, event_type, keep_rate, active
         FROM sentinel.sampling_rules
         WHERE active = 1 AND (tenant_id = toUUID('%s') OR event_type = '*')
         FORMAT JSONEachRow`,
		tenantID,
	)
	return s.queryWithSQL(ctx, query)
}

func (s *Sampler) queryWithSQL(ctx context.Context, sql string) ([]ruleRow, error) {
	endpoint := fmt.Sprintf("http://%s:8123/?query=%s",
		s.cfg.ClickHouseHost, url.QueryEscape(sql))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(s.cfg.ClickHouseUser, s.cfg.ClickHousePassword)

	resp, err := s.chHTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("CH HTTP: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CH returned %d: %s", resp.StatusCode, string(body))
	}

	var rules []ruleRow
	for _, line := range strings.Split(strings.TrimSpace(string(body)), "\n") {
		if line == "" {
			continue
		}
		var r ruleRow
		if err := json.Unmarshal([]byte(line), &r); err != nil {
			slog.Warn("sampling: unmarshal rule row", "line", line, "error", err)
			continue
		}
		rules = append(rules, r)
	}
	return rules, nil
}

func (s *Sampler) incrementRate(ctx context.Context) int64 {
	if s.redis == nil {
		return 0
	}
	key := fmt.Sprintf("%s:%d", rateCounterKey, time.Now().Unix())
	pipe := s.redis.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, (rateWindowS+1)*time.Second)
	if _, err := pipe.Exec(ctx); err != nil {
		slog.Warn("sampling rate counter error", "error", err)
		return 0
	}
	return incr.Val()
}

// CurrentRate returns the latest 1-second ingestion rate for the /metrics endpoint.
func (s *Sampler) CurrentRate(ctx context.Context) int64 {
	if s.redis == nil {
		return 0
	}
	key := fmt.Sprintf("%s:%d", rateCounterKey, time.Now().Unix())
	v, err := s.redis.Get(ctx, key).Int64()
	if err != nil {
		return 0
	}
	return v
}

func hardcodedDefault(eventType string) float64 {
	switch eventType {
	case "Purchase", "OrderPlaced", "InvoicePaid", "Subscribed":
		return 1.0 // Critical — never drop
	case "PageView", "FeatureUsed":
		return 0.1 // High volume, sample aggressively
	default:
		return 0.5
	}
}
