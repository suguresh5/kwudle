package pii

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"github.com/sentinel/ingest/src/model"
)

// Hasher converts raw PII fields to SHA-256 salted hashes in-place.
// The salt is loaded from environment config and never logged.
type Hasher struct {
	salt []byte
}

func NewHasher(salt string) *Hasher {
	return &Hasher{salt: []byte(salt)}
}

// Mask hashes event.RawIPAddress and event.RawEmail into their respective
// *_hash fields, then clears the raw values so they never reach storage.
func (h *Hasher) Mask(event *model.Event) {
	if event.RawIPAddress != "" {
		event.IPAddressHash = h.hash(event.RawIPAddress)
		event.RawIPAddress = ""
	}
	if event.RawEmail != "" {
		event.EmailHash = h.hash(strings.ToLower(strings.TrimSpace(event.RawEmail)))
		event.RawEmail = ""
	}
}

func (h *Hasher) hash(value string) string {
	mac := sha256.New()
	mac.Write(h.salt)
	mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}
