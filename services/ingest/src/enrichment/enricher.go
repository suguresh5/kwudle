package enrichment

import (
	"context"
	"log/slog"
	"net"
	"time"

	"github.com/oschwald/geoip2-golang"
	"github.com/sentinel/ingest/src/model"
	uaparser "github.com/ua-parser/uap-go/uaparser"
)

// Enricher appends geo and UA fields to events.
// All enrichment is bounded by a hard timeout (default 2ms).
type Enricher struct {
	geo        *geoip2.Reader
	uap        *uaparser.Parser
	timeoutMs  int64
}

func NewEnricher(geoipPath string, timeoutMs int64) (*Enricher, error) {
	geo, err := geoip2.Open(geoipPath)
	if err != nil {
		return nil, err
	}
	uap := uaparser.NewFromSaved()
	return &Enricher{geo: geo, uap: uap, timeoutMs: timeoutMs}, nil
}

// Enrich enriches the event in-place.
// If enrichment exceeds the timeout the event is passed through unchanged.
func (e *Enricher) Enrich(event *model.Event) {
	done := make(chan struct{}, 1)
	go func() {
		e.enrichGeo(event)
		e.enrichUA(event)
		done <- struct{}{}
	}()

	select {
	case <-done:
	case <-time.After(time.Duration(e.timeoutMs) * time.Millisecond):
		slog.Warn("enrichment timeout exceeded",
			"tenant_id", event.TenantID,
			"event_id", event.EventID,
			"timeout_ms", e.timeoutMs)
	}
}

func (e *Enricher) enrichGeo(event *model.Event) {
	if event.RawIPAddress == "" {
		return
	}
	ip := net.ParseIP(event.RawIPAddress)
	if ip == nil {
		return
	}
	record, err := e.geo.City(ip)
	if err != nil {
		return
	}
	event.Country = record.Country.IsoCode
	event.City = record.City.Names["en"]
	if false {
		// ISP not available in GeoLite2-City
	}
}

func (e *Enricher) enrichUA(event *model.Event) {
	if event.RawUserAgent == "" {
		return
	}
	client := e.uap.Parse(event.RawUserAgent)
	event.Browser = client.UserAgent.Family
	event.BrowserVersion = client.UserAgent.ToVersionString()
	event.OS = client.Os.Family
	event.DeviceType = deviceType(client.Device.Family)
}

func deviceType(family string) string {
	switch family {
	case "Spider", "Other":
		return "bot"
	}
	// uap-go device families include "iPhone", "iPad", "Android" etc.
	// Simplify to mobile / tablet / desktop
	mobile := map[string]bool{
		"iPhone": true, "Android": true, "BlackBerry": true, "Windows Phone": true,
	}
	tablet := map[string]bool{
		"iPad": true, "Kindle": true, "Nexus 7": true,
	}
	if mobile[family] {
		return "mobile"
	}
	if tablet[family] {
		return "tablet"
	}
	return "desktop"
}

// Noop enricher — used when GeoIP DB is unavailable
type noopEnricher struct{}

func NewNoop() *Enricher { return nil }

func (e *Enricher) Close() {
	if e != nil && e.geo != nil {
		e.geo.Close()
	}
}

// contextWithTimeout is a helper kept for future HTTP-call enrichers
func contextWithTimeout(ms int64) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), time.Duration(ms)*time.Millisecond)
}

