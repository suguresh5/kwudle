package model

// BusinessEventType enumerates all recognised business-domain event types.
// These flow through the same ingest pipeline as generic web events —
// the Properties map carries all domain-specific fields.
type BusinessEventType string

const (
	// ── Restaurant / Cafe ────────────────────────────────────────────────────
	EvtOrderPlaced       BusinessEventType = "OrderPlaced"
	EvtOrderCancelled    BusinessEventType = "OrderCancelled"
	EvtOrderUpdated      BusinessEventType = "OrderUpdated"
	EvtPaymentProcessed  BusinessEventType = "PaymentProcessed"
	EvtPaymentFailed     BusinessEventType = "PaymentFailed"
	EvtTableOccupied     BusinessEventType = "TableOccupied"
	EvtTableFreed        BusinessEventType = "TableFreed"
	EvtMenuItemViewed    BusinessEventType = "MenuItemViewed"
	EvtMenuItemAdded     BusinessEventType = "MenuItemAdded"    // added to cart/order
	EvtStockLow          BusinessEventType = "StockLow"
	EvtStockOut          BusinessEventType = "StockOut"
	EvtStockReplenished  BusinessEventType = "StockReplenished"
	EvtReviewSubmitted   BusinessEventType = "ReviewSubmitted"
	EvtCustomerCheckedIn BusinessEventType = "CustomerCheckedIn"
	EvtLoyaltyEarned     BusinessEventType = "LoyaltyEarned"
	EvtLoyaltyRedeemed   BusinessEventType = "LoyaltyRedeemed"
	EvtKitchenTicket     BusinessEventType = "KitchenTicket"    // order sent to kitchen
	EvtKitchenDone       BusinessEventType = "KitchenDone"      // order ready for pickup
	EvtReservationMade   BusinessEventType = "ReservationMade"
	EvtReservationNoShow BusinessEventType = "ReservationNoShow"

	// ── SaaS / Startup ───────────────────────────────────────────────────────
	EvtSignup          BusinessEventType = "Signup"
	EvtTrial           BusinessEventType = "TrialStarted"
	EvtSubscribed      BusinessEventType = "Subscribed"
	EvtChurned         BusinessEventType = "Churned"
	EvtFeatureUsed     BusinessEventType = "FeatureUsed"
	EvtUpgraded        BusinessEventType = "PlanUpgraded"
	EvtDowngraded      BusinessEventType = "PlanDowngraded"
	EvtInvoicePaid     BusinessEventType = "InvoicePaid"

	// ── Multi-location ───────────────────────────────────────────────────────
	EvtLocationOpen    BusinessEventType = "LocationOpen"
	EvtLocationClose   BusinessEventType = "LocationClose"
)

// IsBusinessEvent returns true if the given event_type string is a known
// business-domain event. Used by the pipeline to apply business-specific
// enrichment logic (e.g. skip geo enrichment for internal kitchen tickets).
func IsBusinessEvent(eventType string) bool {
	switch BusinessEventType(eventType) {
	case
		EvtOrderPlaced, EvtOrderCancelled, EvtOrderUpdated,
		EvtPaymentProcessed, EvtPaymentFailed,
		EvtTableOccupied, EvtTableFreed,
		EvtMenuItemViewed, EvtMenuItemAdded,
		EvtStockLow, EvtStockOut, EvtStockReplenished,
		EvtReviewSubmitted, EvtCustomerCheckedIn,
		EvtLoyaltyEarned, EvtLoyaltyRedeemed,
		EvtKitchenTicket, EvtKitchenDone,
		EvtReservationMade, EvtReservationNoShow,
		EvtSignup, EvtTrial, EvtSubscribed, EvtChurned,
		EvtFeatureUsed, EvtUpgraded, EvtDowngraded, EvtInvoicePaid,
		EvtLocationOpen, EvtLocationClose:
		return true
	}
	return false
}

// BusinessFields extracts well-known business domain fields from the raw
// Properties map into a typed struct. Unknown fields remain in Properties.
// This is used to validate and index business metrics efficiently.
type BusinessFields struct {
	// Common
	LocationID string  `json:"location_id"` // branch / franchise location
	Amount     float64 `json:"amount"`      // monetary value in base currency
	Currency   string  `json:"currency"`    // ISO 4217, e.g. "INR", "USD"

	// Order
	OrderID    string   `json:"order_id"`
	TableID    string   `json:"table_id"`
	Items      []string `json:"items"`       // item names / IDs
	Quantity   int      `json:"quantity"`
	Category   string   `json:"category"`    // "Beverage", "Food", etc.

	// Payment
	PaymentMethod string `json:"payment_method"` // "cash","card","upi","wallet"

	// Review
	Rating  int    `json:"rating"`  // 1–5
	Comment string `json:"comment"`

	// Inventory
	ItemID      string  `json:"item_id"`
	CurrentQty  float64 `json:"current_qty"`
	Threshold   float64 `json:"threshold"`
	Unit        string  `json:"unit"` // "kg","litres","units"

	// Customer / Loyalty
	LoyaltyPoints int    `json:"loyalty_points"`
	Tier          string `json:"tier"` // "bronze","silver","gold"

	// SaaS
	Plan          string  `json:"plan"`
	MRRDelta      float64 `json:"mrr_delta"`
	FeatureName   string  `json:"feature_name"`
	TrialDays     int     `json:"trial_days"`
}

// ExtractBusinessFields pulls recognised fields out of a Properties map.
// Unrecognised keys remain in the map (schemaless passthrough).
func ExtractBusinessFields(props map[string]interface{}) BusinessFields {
	bf := BusinessFields{}
	if v, ok := props["location_id"].(string); ok { bf.LocationID = v }
	if v, ok := props["amount"].(float64); ok { bf.Amount = v }
	if v, ok := props["currency"].(string); ok { bf.Currency = v }
	if v, ok := props["order_id"].(string); ok { bf.OrderID = v }
	if v, ok := props["table_id"].(string); ok { bf.TableID = v }
	if v, ok := props["quantity"].(float64); ok { bf.Quantity = int(v) }
	if v, ok := props["category"].(string); ok { bf.Category = v }
	if v, ok := props["payment_method"].(string); ok { bf.PaymentMethod = v }
	if v, ok := props["rating"].(float64); ok { bf.Rating = int(v) }
	if v, ok := props["comment"].(string); ok { bf.Comment = v }
	if v, ok := props["item_id"].(string); ok { bf.ItemID = v }
	if v, ok := props["current_qty"].(float64); ok { bf.CurrentQty = v }
	if v, ok := props["threshold"].(float64); ok { bf.Threshold = v }
	if v, ok := props["unit"].(string); ok { bf.Unit = v }
	if v, ok := props["loyalty_points"].(float64); ok { bf.LoyaltyPoints = int(v) }
	if v, ok := props["tier"].(string); ok { bf.Tier = v }
	if v, ok := props["plan"].(string); ok { bf.Plan = v }
	if v, ok := props["mrr_delta"].(float64); ok { bf.MRRDelta = v }
	if v, ok := props["feature_name"].(string); ok { bf.FeatureName = v }
	if v, ok := props["trial_days"].(float64); ok { bf.TrialDays = int(v) }
	return bf
}
