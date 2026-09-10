package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/sentinel/ingest/src/batcher"
	"github.com/sentinel/ingest/src/config"
	"github.com/sentinel/ingest/src/enrichment"
	"github.com/sentinel/ingest/src/middleware"
	"github.com/sentinel/ingest/src/model"
	"github.com/sentinel/ingest/src/otel"
	"github.com/sentinel/ingest/src/pii"
	"github.com/sentinel/ingest/src/sampling"
	"github.com/sentinel/ingest/src/schema"
	"github.com/valyala/fasthttp"
)

type Deps struct {
	Auth           *middleware.AuthMiddleware
	PII            *pii.Hasher
	Enricher       *enrichment.Enricher
	Sampler        *sampling.Sampler
	SchemaRegistry *schema.Registry
	Batcher        *batcher.Batcher
	OTelNormalizer *otel.Normalizer
	Config         *config.Config
}

type Handler struct{ deps Deps }

func New(d Deps) *Handler { return &Handler{deps: d} }

func (h *Handler) Route() fasthttp.RequestHandler {
	return func(ctx *fasthttp.RequestCtx) {
		path := string(ctx.Path())
		method := string(ctx.Method())
		switch {
		case path == "/health" && method == "GET":
			ctx.SetStatusCode(200)
			ctx.SetBodyString(`{"status":"ok"}`)
		case path == "/v1/events" && method == "POST":
			h.handleEvents(ctx)
		case path == "/v1/traces" && method == "POST":
			h.handleOTelTraces(ctx)
		case path == "/v1/metrics" && method == "POST":
			h.handleOTelMetrics(ctx)
		case path == "/admin/dlq/replay" && method == "POST":
			h.handleDLQReplay(ctx)
		case path == "/admin/tenants" && method == "POST":
			h.handleCreateTenant(ctx)
		case path == "/metrics" && method == "GET":
			h.handleMetrics(ctx)
		default:
			ctx.SetStatusCode(404)
		}
	}
}

func (h *Handler) handleEvents(ctx *fasthttp.RequestCtx) {
	tenantID, ok := h.deps.Auth.Authenticate(ctx)
	if !ok {
		return
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(ctx.Request.Body(), &raw); err != nil {
		ctx.SetStatusCode(400)
		writeJSON(ctx, map[string]string{"error": "invalid JSON"})
		return
	}
	event := mapToEvent(raw, tenantID)
	h.processPipeline(ctx, event)
	ctx.SetStatusCode(202)
	writeJSON(ctx, map[string]string{"status": "accepted", "event_id": event.EventID})
}

func (h *Handler) handleOTelTraces(ctx *fasthttp.RequestCtx) {
	tenantID, ok := h.deps.Auth.Authenticate(ctx)
	if !ok {
		return
	}
	events, err := h.deps.OTelNormalizer.NormalizeTraces(ctx.Request.Body(), tenantID)
	if err != nil {
		slog.Error("otel trace normalization failed", "error", err)
		ctx.SetStatusCode(400)
		return
	}
	for _, ev := range events {
		h.processPipeline(ctx, ev)
	}
	ctx.SetStatusCode(200)
}

func (h *Handler) handleOTelMetrics(ctx *fasthttp.RequestCtx) {
	tenantID, ok := h.deps.Auth.Authenticate(ctx)
	if !ok {
		return
	}
	events, err := h.deps.OTelNormalizer.NormalizeMetrics(ctx.Request.Body(), tenantID)
	if err != nil {
		slog.Error("otel metrics normalization failed", "error", err)
		ctx.SetStatusCode(400)
		return
	}
	for _, ev := range events {
		h.processPipeline(ctx, ev)
	}
	ctx.SetStatusCode(200)
}

// processPipeline: Auth → PII → Enrich → Sample → Schema → Batch
func (h *Handler) processPipeline(ctx *fasthttp.RequestCtx, event *model.Event) {
	h.deps.PII.Mask(event)
	if h.deps.Enricher != nil {
		h.deps.Enricher.Enrich(event)
	}
	keep, rate := h.deps.Sampler.ShouldKeep(context.Background(), event)
	event.SamplingRate = rate
	if !keep {
		return
	}
	if len(event.Properties) > 0 {
		h.deps.SchemaRegistry.CheckAndEnqueue(event.Properties)
	}
	event.IngestedBy = h.deps.Config.ServiceName
	h.deps.Batcher.Add(event)
}

func (h *Handler) handleDLQReplay(ctx *fasthttp.RequestCtx) {
	ctx.SetStatusCode(202)
	writeJSON(ctx, map[string]string{"status": "replay queued"})
}

func (h *Handler) handleCreateTenant(ctx *fasthttp.RequestCtx) {
	ctx.SetStatusCode(201)
	writeJSON(ctx, map[string]string{"status": "created"})
}

func (h *Handler) handleMetrics(ctx *fasthttp.RequestCtx) {
	rate := h.deps.Sampler.CurrentRate(context.Background())
	depth := h.deps.Batcher.QueueDepth()
	ctx.SetContentType("text/plain; version=0.0.4")
	ctx.SetBodyString(fmt.Sprintf(
		"# HELP sentinel_ingest_rate_per_second Current ingestion rate\n"+
			"# TYPE sentinel_ingest_rate_per_second gauge\n"+
			"sentinel_ingest_rate_per_second %d\n"+
			"# HELP sentinel_batcher_queue_depth Batcher queue depth\n"+
			"# TYPE sentinel_batcher_queue_depth gauge\n"+
			"sentinel_batcher_queue_depth %d\n",
		rate, depth,
	))
}

func mapToEvent(raw map[string]interface{}, tenantID string) *model.Event {
	ev := &model.Event{
		EventID:    uuid.NewString(),
		TenantID:   tenantID,
		ReceivedAt: time.Now().UTC(),
		Properties: make(map[string]interface{}),
	}
	for k, v := range raw {
		switch k {
		case "event_type":     ev.EventType, _ = v.(string)
		case "user_id":        ev.UserID, _ = v.(string)
		case "session_id":     ev.SessionID, _ = v.(string)
		case "anonymous_id":   ev.AnonymousID, _ = v.(string)
		case "ip":             ev.RawIPAddress, _ = v.(string)
		case "email":          ev.RawEmail, _ = v.(string)
		case "user_agent":     ev.RawUserAgent, _ = v.(string)
		case "latency_ms":     ev.LatencyMs, _ = v.(float64)
		case "error_code":     ev.ErrorCode, _ = v.(string)
		case "trace_id":       ev.TraceID, _ = v.(string)
		case "span_id":        ev.SpanID, _ = v.(string)
		case "service_name":   ev.ServiceName, _ = v.(string)
		case "deployment_env": ev.DeploymentEnv, _ = v.(string)
		case "timestamp":
			if ts, ok := v.(string); ok {
				if t, err := time.Parse(time.RFC3339, ts); err == nil {
					ev.Timestamp = t
				}
			}
		case "status_code":
			if sc, ok := v.(float64); ok { ev.StatusCode = uint16(sc) }
		default:
			ev.Properties[k] = v
		}
	}
	if ev.Timestamp.IsZero() {
		ev.Timestamp = ev.ReceivedAt
	}
	return ev
}

func writeJSON(ctx *fasthttp.RequestCtx, body interface{}) {
	ctx.SetContentType("application/json")
	json.NewEncoder(ctx).Encode(body)
}
