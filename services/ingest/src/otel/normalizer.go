package otel

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/sentinel/ingest/src/model"
)

// Normalizer maps OTLP/HTTP JSON payloads onto Sentinel's canonical Event schema.
type Normalizer struct{}

func NewNormalizer() *Normalizer { return &Normalizer{} }

// ── OTLP Trace structures ────────────────────────────────────────────────────

type TracesPayload struct {
	ResourceSpans []ResourceSpan `json:"resourceSpans"`
}
type ResourceSpan struct {
	Resource   Resource    `json:"resource"`
	ScopeSpans []ScopeSpan `json:"scopeSpans"`
}
type Resource struct {
	Attributes []KeyValue `json:"attributes"`
}
type ScopeSpan struct {
	Spans []Span `json:"spans"`
}
type Span struct {
	TraceID           string     `json:"traceId"`
	SpanID            string     `json:"spanId"`
	ParentSpanID      string     `json:"parentSpanId"`
	Name              string     `json:"name"`
	StartTimeUnixNano string     `json:"startTimeUnixNano"`
	EndTimeUnixNano   string     `json:"endTimeUnixNano"`
	Attributes        []KeyValue `json:"attributes"`
	Status            SpanStatus `json:"status"`
}
type SpanStatus struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}
type KeyValue struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
}

// ── OTLP Metrics structures ──────────────────────────────────────────────────

type MetricsPayload struct {
	ResourceMetrics []ResourceMetric `json:"resourceMetrics"`
}
type ResourceMetric struct {
	Resource     Resource       `json:"resource"`
	ScopeMetrics []ScopeMetric  `json:"scopeMetrics"`
}
type ScopeMetric struct {
	Metrics []Metric `json:"metrics"`
}
type Metric struct {
	Name  string  `json:"name"`
	Gauge *Gauge  `json:"gauge,omitempty"`
	Sum   *Sum    `json:"sum,omitempty"`
}
type Gauge struct{ DataPoints []NumberDataPoint `json:"dataPoints"` }
type Sum   struct{ DataPoints []NumberDataPoint `json:"dataPoints"` }
type NumberDataPoint struct {
	TimeUnixNano string     `json:"timeUnixNano"`
	AsDouble     float64    `json:"asDouble"`
	Attributes   []KeyValue `json:"attributes"`
}

// NormalizeTraces converts OTLP trace payload to Sentinel events.
func (n *Normalizer) NormalizeTraces(body []byte, tenantID string) ([]*model.Event, error) {
	var payload TracesPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("otel traces unmarshal: %w", err)
	}
	var events []*model.Event
	for _, rs := range payload.ResourceSpans {
		resourceAttrs := kvToMap(rs.Resource.Attributes)
		serviceName, _ := resourceAttrs["service.name"].(string)
		for _, ss := range rs.ScopeSpans {
			for _, span := range ss.Spans {
				spanAttrs := kvToMap(span.Attributes)
				ts := nanoStringToTime(span.StartTimeUnixNano)
				endTs := nanoStringToTime(span.EndTimeUnixNano)
				var latencyMs float64
				if !endTs.IsZero() && !ts.IsZero() {
					latencyMs = float64(endTs.Sub(ts).Milliseconds())
				}
				errorCode := ""
				if span.Status.Code == 2 {
					errorCode = span.Status.Message
					if errorCode == "" {
						errorCode = "ERROR"
					}
				}
				props := make(map[string]interface{})
				for k, v := range resourceAttrs { props["resource."+k] = v }
				for k, v := range spanAttrs     { props[k] = v }

				ev := &model.Event{
					EventID:      uuid.NewString(),
					TenantID:     tenantID,
					EventType:    "trace.span",
					Timestamp:    ts,
					TraceID:      span.TraceID,
					SpanID:       span.SpanID,
					ParentSpanID: span.ParentSpanID,
					ServiceName:  serviceName,
					LatencyMs:    latencyMs,
					ErrorCode:    errorCode,
					SamplingRate: 1.0,
					Properties:   props,
					ReceivedAt:   time.Now().UTC(),
				}
				if ua, ok := spanAttrs["http.user_agent"].(string); ok { ev.RawUserAgent = ua }
				if ip, ok := spanAttrs["net.peer.ip"].(string);      ok { ev.RawIPAddress = ip }
				if sc, ok := spanAttrs["http.status_code"].(float64); ok { ev.StatusCode = uint16(sc) }
				events = append(events, ev)
			}
		}
	}
	slog.Info("otel traces normalized", "spans", len(events), "tenant_id", tenantID)
	return events, nil
}

// NormalizeMetrics converts OTLP metrics payload to Sentinel events.
func (n *Normalizer) NormalizeMetrics(body []byte, tenantID string) ([]*model.Event, error) {
	var payload MetricsPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("otel metrics unmarshal: %w", err)
	}
	var events []*model.Event
	for _, rm := range payload.ResourceMetrics {
		resourceAttrs := kvToMap(rm.Resource.Attributes)
		serviceName, _ := resourceAttrs["service.name"].(string)
		for _, sm := range rm.ScopeMetrics {
			for _, metric := range sm.Metrics {
				var dps []NumberDataPoint
				if metric.Gauge != nil { dps = metric.Gauge.DataPoints }
				if metric.Sum   != nil { dps = metric.Sum.DataPoints   }
				for _, dp := range dps {
					props := kvToMap(dp.Attributes)
					props["metric.name"]  = metric.Name
					props["metric.value"] = dp.AsDouble
					events = append(events, &model.Event{
						EventID:      uuid.NewString(),
						TenantID:     tenantID,
						EventType:    "metric." + metric.Name,
						Timestamp:    nanoStringToTime(dp.TimeUnixNano),
						ServiceName:  serviceName,
						LatencyMs:    dp.AsDouble,
						SamplingRate: 1.0,
						Properties:   props,
						ReceivedAt:   time.Now().UTC(),
					})
				}
			}
		}
	}
	slog.Info("otel metrics normalized", "events", len(events), "tenant_id", tenantID)
	return events, nil
}

func kvToMap(kvs []KeyValue) map[string]interface{} {
	m := make(map[string]interface{}, len(kvs))
	for _, kv := range kvs { m[kv.Key] = kv.Value }
	return m
}

func nanoStringToTime(s string) time.Time {
	if s == "" { return time.Time{} }
	var ns int64
	if _, err := fmt.Sscanf(s, "%d", &ns); err != nil { return time.Time{} }
	return time.Unix(0, ns).UTC()
}
