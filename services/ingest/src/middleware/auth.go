package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sentinel/ingest/src/config"
	"github.com/valyala/fasthttp"
)

const (
	apiKeyCacheTTL  = 5 * time.Minute
	gracePeriodKey  = "grace:apikey:%s" // holds tenantID during 24h grace window
	gracePeriodTTL  = 24 * time.Hour
)

type APIKeyRecord struct {
	TenantID      string `json:"tenant_id"`
	RateLimitTier string `json:"rate_limit_tier"`
	Revoked       bool   `json:"revoked"`
}

type AuthMiddleware struct {
	redis  *redis.Client
	cfg    *config.Config
	chHTTP *http.Client
}

func NewAuthMiddleware(r *redis.Client, _ interface{}, cfg *config.Config) *AuthMiddleware {
	return &AuthMiddleware{
		redis:  r,
		cfg:    cfg,
		chHTTP: &http.Client{Timeout: 3 * time.Second},
	}
}

// Authenticate resolves an API key to a tenantID using a three-level lookup:
//  1. Redis cache (5-min TTL, populated on first DB hit)
//  2. Redis grace-period key (valid for 24h after key rotation)
//  3. ClickHouse HTTP query (populates Redis cache for future requests)
func (a *AuthMiddleware) Authenticate(ctx *fasthttp.RequestCtx) (string, bool) {
	authHeader := string(ctx.Request.Header.Peek("Authorization"))
	if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
		ctx.SetStatusCode(401)
		ctx.SetBodyString(`{"error":"missing Authorization header"}`)
		return "", false
	}
	rawKey := authHeader[7:]
	hash := sha256Hex(rawKey)

	// ── 1. Redis cache ────────────────────────────────────────────────────────
	cacheKey := fmt.Sprintf("apikey:%s", hash)
	if cached, err := a.redis.Get(context.Background(), cacheKey).Result(); err == nil {
		var record APIKeyRecord
		if err := json.Unmarshal([]byte(cached), &record); err == nil {
			if record.Revoked {
				// Check grace-period key before rejecting
				if tenantID, ok := a.checkGracePeriod(hash); ok {
					ctx.SetUserValue("tenant_id", tenantID)
					return tenantID, true
				}
				ctx.SetStatusCode(401)
				ctx.SetBodyString(`{"error":"API key revoked"}`)
				return "", false
			}
			ctx.SetUserValue("tenant_id", record.TenantID)
			return record.TenantID, true
		}
	}

	// ── 2. Grace-period key (set by key rotation) ─────────────────────────────
	if tenantID, ok := a.checkGracePeriod(hash); ok {
		ctx.SetUserValue("tenant_id", tenantID)
		slog.Info("auth: grace period key accepted", "hash", hash[:8]+"…")
		return tenantID, true
	}

	// ── 3. ClickHouse fallback ────────────────────────────────────────────────
	record, err := a.queryKeyFromCH(hash)
	if err != nil {
		slog.Warn("auth: CH fallback error", "error", err)
		ctx.SetStatusCode(401)
		ctx.SetBodyString(`{"error":"invalid or unknown API key"}`)
		return "", false
	}
	if record.Revoked {
		ctx.SetStatusCode(401)
		ctx.SetBodyString(`{"error":"API key revoked"}`)
		return "", false
	}

	// Populate Redis cache so next request is fast
	if b, err := json.Marshal(record); err == nil {
		a.redis.Set(context.Background(), cacheKey, string(b), apiKeyCacheTTL)
	}
	ctx.SetUserValue("tenant_id", record.TenantID)
	return record.TenantID, true
}

// checkGracePeriod reads the grace-period key (written by the rotation endpoint).
// Returns (tenantID, true) if the key is still within its 24-hour grace window.
func (a *AuthMiddleware) checkGracePeriod(hash string) (string, bool) {
	gk := fmt.Sprintf(gracePeriodKey, hash)
	tenantID, err := a.redis.Get(context.Background(), gk).Result()
	if err != nil {
		return "", false
	}
	return tenantID, true
}

func (a *AuthMiddleware) queryKeyFromCH(hash string) (*APIKeyRecord, error) {
	sql := fmt.Sprintf(
		`SELECT tenant_id, rate_limit_tier, revoked
         FROM sentinel.api_keys FINAL
         WHERE key_hash = '%s'
         LIMIT 1
         FORMAT JSONEachRow`,
		hash,
	)
	endpoint := fmt.Sprintf("http://%s:8123/?query=%s",
		a.cfg.ClickHouseHost, url.QueryEscape(sql))

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(a.cfg.ClickHouseUser, a.cfg.ClickHousePassword)

	resp, err := a.chHTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("CH HTTP: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CH returned %d", resp.StatusCode)
	}

	lines := strings.Split(strings.TrimSpace(string(body)), "\n")
	if len(lines) == 0 || lines[0] == "" {
		return nil, fmt.Errorf("key not found in CH")
	}

	var row struct {
		TenantID      string `json:"tenant_id"`
		RateLimitTier string `json:"rate_limit_tier"`
		Revoked       uint8  `json:"revoked"`
	}
	if err := json.Unmarshal([]byte(lines[0]), &row); err != nil {
		return nil, err
	}
	return &APIKeyRecord{
		TenantID:      row.TenantID,
		RateLimitTier: row.RateLimitTier,
		Revoked:       row.Revoked == 1,
	}, nil
}

func TenantID(ctx *fasthttp.RequestCtx) string {
	if v := ctx.UserValue("tenant_id"); v != nil {
		return v.(string)
	}
	return ""
}

func sha256Hex(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

var _ = slog.Info
