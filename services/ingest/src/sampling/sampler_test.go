package sampling

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/sentinel/ingest/src/config"
	"github.com/sentinel/ingest/src/model"
)

func TestHardcodedDefaults(t *testing.T) {
	tests := []struct {
		eventType string
		expected  float64
	}{
		{"Purchase", 1.0},
		{"OrderPlaced", 1.0},
		{"InvoicePaid", 1.0},
		{"Subscribed", 1.0},
		{"PageView", 0.1},
		{"FeatureUsed", 0.1},
		{"UnknownEvent", 0.5},
		{"CustomMetrics", 0.5},
	}

	for _, tt := range tests {
		t.Run(tt.eventType, func(t *testing.T) {
			rate := hardcodedDefault(tt.eventType)
			if rate != tt.expected {
				t.Errorf("hardcodedDefault(%q) = %v; want %v", tt.eventType, rate, tt.expected)
			}
		})
	}
}

func TestShouldKeepUnderThreshold(t *testing.T) {
	// Without Redis, incrementRate returns 0, which is <= threshold (1000)
	cfg := &config.Config{
		SamplingThreshold: 1000,
	}
	s := &Sampler{
		threshold: cfg.SamplingThreshold,
		cfg:       cfg,
	}

	event := &model.Event{
		EventID:      uuid.NewString(),
		TenantID:     uuid.NewString(),
		EventType:    "PageView",
		SamplingRate: 0,
	}

	keep, rate := s.ShouldKeep(context.Background(), event)
	if !keep {
		t.Errorf("expected event to be kept under threshold")
	}
	if rate != 1.0 {
		t.Errorf("expected rate 1.0 under threshold, got %v", rate)
	}
	if event.SamplingRate != 1.0 {
		t.Errorf("expected event.SamplingRate = 1.0, got %v", event.SamplingRate)
	}
}
