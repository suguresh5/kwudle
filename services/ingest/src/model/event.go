package model

import "time"

// Event is the canonical internal representation of a single event
// as it flows through the ingestion pipeline.
type Event struct {
	// Identity
	EventID   string    `json:"event_id"`
	TenantID  string    `json:"tenant_id"`
	EventType string    `json:"event_type"`
	Timestamp time.Time `json:"timestamp"`

	// User
	UserID      string `json:"user_id"`
	SessionID   string `json:"session_id"`
	AnonymousID string `json:"anonymous_id"`

	// PII (hashed at ingestion)
	IPAddressHash string `json:"ip_address_hash"`
	EmailHash     string `json:"email_hash"`

	// Geo (enriched)
	Country string `json:"country"`
	City    string `json:"city"`
	ISP     string `json:"isp"`

	// UA (enriched)
	Browser        string `json:"browser"`
	BrowserVersion string `json:"browser_version"`
	OS             string `json:"os"`
	DeviceType     string `json:"device_type"`

	// Observability
	LatencyMs  float64 `json:"latency_ms"`
	ErrorCode  string  `json:"error_code"`
	StatusCode uint16  `json:"status_code"`

	// OTel
	TraceID      string `json:"trace_id"`
	SpanID       string `json:"span_id"`
	ParentSpanID string `json:"parent_span_id"`
	ServiceName  string `json:"service_name"`

	// Sampling
	SamplingRate float64 `json:"sampling_rate"`

	// Deployment
	DeploymentEnv string `json:"deployment_env"`

	// Arbitrary schemaless payload
	Properties map[string]interface{} `json:"properties"`

	// Ingest metadata
	ReceivedAt  time.Time `json:"received_at"`
	IngestedBy  string    `json:"ingested_by"`

	// Internal pipeline fields (not persisted)
	RawIPAddress string `json:"-"`
	RawEmail     string `json:"-"`
	RawUserAgent string `json:"-"`
}
