package pii

import (
	"testing"

	"github.com/sentinel/ingest/src/model"
)

func TestHasherMask(t *testing.T) {
	hasher := NewHasher("secret-salt-123")

	event := &model.Event{
		RawIPAddress: "192.168.1.50",
		RawEmail:     " User@Example.COM ",
	}

	hasher.Mask(event)

	// Raw values must be cleared
	if event.RawIPAddress != "" {
		t.Errorf("expected RawIPAddress to be cleared, got %q", event.RawIPAddress)
	}
	if event.RawEmail != "" {
		t.Errorf("expected RawEmail to be cleared, got %q", event.RawEmail)
	}

	// Hashes must be non-empty and 64 hex characters (SHA-256)
	if len(event.IPAddressHash) != 64 {
		t.Errorf("expected 64-char IPAddressHash, got %d (%q)", len(event.IPAddressHash), event.IPAddressHash)
	}
	if len(event.EmailHash) != 64 {
		t.Errorf("expected 64-char EmailHash, got %d (%q)", len(event.EmailHash), event.EmailHash)
	}

	// Verify case-insensitivity and trim for email
	event2 := &model.Event{
		RawEmail: "user@example.com",
	}
	hasher.Mask(event2)
	if event.EmailHash != event2.EmailHash {
		t.Errorf("expected normalized email hashes to match; got %q != %q", event.EmailHash, event2.EmailHash)
	}
}

func TestHasherSaltSensitivity(t *testing.T) {
	h1 := NewHasher("salt-alpha")
	h2 := NewHasher("salt-beta")

	e1 := &model.Event{RawIPAddress: "10.0.0.1"}
	e2 := &model.Event{RawIPAddress: "10.0.0.1"}

	h1.Mask(e1)
	h2.Mask(e2)

	if e1.IPAddressHash == e2.IPAddressHash {
		t.Errorf("different salts produced identical hashes")
	}
}
