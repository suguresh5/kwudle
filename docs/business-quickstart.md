# Business Quickstart Guide

Connect your cafe, restaurant, retail shop, or SaaS startup to Kwudle in minutes.

## Prerequisites

```bash
# 1. Start the platform
docker compose up -d

# 2. Get your API key
curl -X POST http://localhost:8080/admin/tenants \
  -H 'Content-Type: application/json' \
  -d '{"name":"My Cafe","tier":"pro"}'
# → Returns: { "tenant_id": "...", "api_key": "sk_..." }
```

---

## ☕ Cafe & Restaurant Events

### Record an Order

```bash
curl -X POST http://localhost:8080/v1/events \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "event_type": "OrderPlaced",
    "user_id": "customer_123",
    "properties": {
      "order_id":    "ord_001",
      "table_id":    "T3",
      "amount":      450,
      "item_id":     "Cappuccino",
      "category":    "Beverage",
      "location_id": "main_branch"
    }
  }'
```

### Record Payment

```bash
curl -X POST http://localhost:8080/v1/events \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "event_type": "PaymentProcessed",
    "user_id": "customer_123",
    "properties": {
      "order_id":       "ord_001",
      "amount":         450,
      "payment_method": "upi",
      "location_id":    "main_branch"
    }
  }'
```

### Track Table Occupancy

```bash
# Table occupied
curl -X POST http://localhost:8080/v1/events \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"event_type":"TableOccupied","properties":{"table_id":"T3","party_size":2,"location_id":"main_branch"}}'

# Table freed (after payment)
curl -X POST http://localhost:8080/v1/events \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"event_type":"TableFreed","properties":{"table_id":"T3","duration_minutes":42,"location_id":"main_branch"}}'
```

### Stock Alerts

```bash
# Low stock
curl -X POST http://localhost:8080/v1/events \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"event_type":"StockLow","properties":{"item_id":"Oat Milk","current_qty":1.5,"threshold":5,"unit":"litres","category":"Dairy","location_id":"main_branch"}}'

# Out of stock
curl -X POST http://localhost:8080/v1/events \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"event_type":"StockOut","properties":{"item_id":"Oat Milk","current_qty":0,"unit":"litres","category":"Dairy","location_id":"main_branch"}}'
```

### Customer Review

```bash
curl -X POST http://localhost:8080/v1/events \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"event_type":"ReviewSubmitted","user_id":"customer_123","properties":{"order_id":"ord_001","rating":5,"comment":"Amazing coffee!","location_id":"main_branch"}}'
```

### Loyalty Program

```bash
curl -X POST http://localhost:8080/v1/events \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"event_type":"LoyaltyEarned","user_id":"customer_123","properties":{"loyalty_points":45,"tier":"silver","location_id":"main_branch"}}'
```

---

## 🚀 SaaS / Startup Events

```bash
# Signup
curl -X POST http://localhost:8080/v1/events \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"event_type":"Signup","user_id":"user_abc","properties":{"plan":"free","source":"google_ads"}}'

# Trial started
curl -X POST http://localhost:8080/v1/events \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"event_type":"TrialStarted","user_id":"user_abc","properties":{"trial_days":14,"plan":"pro"}}'

# Subscribed
curl -X POST http://localhost:8080/v1/events \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"event_type":"Subscribed","user_id":"user_abc","properties":{"plan":"pro","mrr_delta":999}}'

# Feature used
curl -X POST http://localhost:8080/v1/events \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"event_type":"FeatureUsed","user_id":"user_abc","properties":{"feature_name":"export_report"}}'

# Churned
curl -X POST http://localhost:8080/v1/events \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"event_type":"Churned","user_id":"user_abc","properties":{"plan":"pro","mrr_delta":-999}}'
```

---

## 🏪 Multi-Location Support

Add `location_id` to every event to enable per-branch filtering:

```json
{
  "event_type": "OrderPlaced",
  "properties": {
    "location_id": "branch_koramangala",
    ...
  }
}
```

View all locations from the API:
```bash
curl http://localhost:3001/api/business/locations \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

---

## 📊 Business API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/business/revenue` | Revenue + order count by day/hour |
| `GET /api/business/top-items` | Best-selling items by revenue |
| `GET /api/business/peak-hours` | 7×24 order heatmap |
| `GET /api/business/table-turnover` | Avg occupancy per table |
| `GET /api/business/customer-loyalty` | Repeat rate, avg visit frequency |
| `GET /api/business/stock` | Items below threshold NOW |
| `GET /api/business/live` | Open orders + occupied tables + today's revenue |
| `GET /api/business/reviews` | Recent ratings + avg score |
| `GET /api/business/saas` | MRR, funnel, feature adoption |
| `GET /api/business/locations` | Revenue per branch |
| `GET /api/business/alert-templates` | Pre-built alert rule templates |

All endpoints accept:
- `?days=30` — lookback window (default 30)
- `?location=branch_id` — filter by location
- `?limit=10` — max results

---

## 🔔 Smart Alert Templates

Auto-provision all pre-built alerts for your tenant:

```bash
# Get all templates
curl http://localhost:3001/api/business/alert-templates \
  -H 'Authorization: Bearer YOUR_API_KEY'

# Get only restaurant templates
curl 'http://localhost:3001/api/business/alert-templates?category=restaurant' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

**Pre-built alerts include:**

| Alert | Trigger | Severity |
|---|---|---|
| 🚨 Stock Critical | Any StockOut event | Critical |
| ⚠️ Stock Low | Any StockLow event | Warning |
| ⏳ Kitchen Delay | >2 orders waiting >25 min | Warning |
| 🪑 Long Table Wait | Table occupied >90 min | Info |
| 🔥 Order Surge | >20 orders/min | Info |
| 🎯 Revenue Target | Daily revenue ≥ ₹10,000 | Info |
| 😡 Negative Reviews | ≥3 low ratings in 30 min | Warning |
| 💳 Payment Failures | ≥5 failures in 10 min | Critical |
| 😰 Churn Spike | ≥3 churns in 1 hour (SaaS) | Critical |
| 🎉 Signup Milestone | 100 signups today (SaaS) | Info |

---

## 🖥️ Open the Dashboard

```
http://localhost:3000/dashboard            ← Command Center & Business Intelligence
http://localhost:3000/dashboard/onboarding ← Setup Wizard
```
