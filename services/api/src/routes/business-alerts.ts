/**
 * Business Alert Rule Templates
 *
 * Pre-built alert configurations for cafes, restaurants, and startups.
 * Provision these via POST /api/alerts/rules using a tenant's API key.
 *
 * Each rule object matches the existing AlertRule schema in the worker
 * service. The "metric_sql" field uses parameterised ClickHouse SQL
 * evaluated every 60 seconds by sentinel-worker.
 */

export type AlertChannel = 'dashboard' | 'slack' | 'pagerduty' | 'email'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface BusinessAlertTemplate {
  name: string
  description: string
  severity: AlertSeverity
  category: 'inventory' | 'revenue' | 'operations' | 'experience' | 'saas'
  /** ClickHouse SQL — must SELECT a single numeric "value" column */
  metric_sql: string
  threshold: number
  operator: '>' | '<' | '>=' | '<=' | '=='
  /** Minutes to wait before re-firing the same alert */
  cooldown_minutes: number
  recommended_channels: AlertChannel[]
  emoji: string
}

/**
 * BUSINESS_ALERT_TEMPLATES
 * All templates available out-of-the-box for any new business tenant.
 */
export const BUSINESS_ALERT_TEMPLATES: BusinessAlertTemplate[] = [
  // ── Inventory / Stock ─────────────────────────────────────────────────────
  {
    name: 'Stock Critical — Item Out',
    description: 'Fires when any item emits a StockOut event in the last 10 minutes',
    severity: 'critical',
    category: 'inventory',
    emoji: '🚨',
    metric_sql: `
      SELECT count() AS value
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'StockOut'
        AND timestamp >= now() - INTERVAL 10 MINUTE`,
    threshold: 0,
    operator: '>',
    cooldown_minutes: 30,
    recommended_channels: ['dashboard', 'slack'],
  },
  {
    name: 'Stock Low — Below Threshold',
    description: 'Fires when any item emits a StockLow event in the last 15 minutes',
    severity: 'warning',
    category: 'inventory',
    emoji: '⚠️',
    metric_sql: `
      SELECT count() AS value
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'StockLow'
        AND timestamp >= now() - INTERVAL 15 MINUTE`,
    threshold: 0,
    operator: '>',
    cooldown_minutes: 60,
    recommended_channels: ['dashboard'],
  },

  // ── Operations ────────────────────────────────────────────────────
  {
    name: 'Kitchen Delay — Orders Waiting > 25 min',
    description: 'Fires when more than 2 open orders have been waiting over 25 minutes',
    severity: 'warning',
    category: 'operations',
    emoji: '⏳',
    metric_sql: `
      SELECT countIf(
        dateDiff('minute', timestamp, now()) > 25
        AND JSONExtractString(properties, 'order_id') NOT IN (
          SELECT JSONExtractString(properties, 'order_id')
          FROM sentinel.events
          WHERE tenant_id = {tenantId:UUID}
            AND event_type = 'PaymentProcessed'
            AND timestamp >= now() - INTERVAL 2 HOUR
        )
      ) AS value
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'OrderPlaced'
        AND timestamp >= now() - INTERVAL 2 HOUR`,
    threshold: 2,
    operator: '>',
    cooldown_minutes: 15,
    recommended_channels: ['dashboard'],
  },
  {
    name: 'Long Table Wait — Occupied > 90 min',
    description: 'Fires when a table has been occupied for more than 90 minutes',
    severity: 'info',
    category: 'operations',
    emoji: '🪑',
    metric_sql: `
      SELECT countIf(
        dateDiff('minute', timestamp, now()) > 90
        AND JSONExtractString(properties, 'table_id') NOT IN (
          SELECT JSONExtractString(properties, 'table_id')
          FROM sentinel.events
          WHERE tenant_id = {tenantId:UUID}
            AND event_type = 'TableFreed'
            AND timestamp >= now() - INTERVAL 4 HOUR
        )
      ) AS value
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'TableOccupied'
        AND timestamp >= now() - INTERVAL 4 HOUR`,
    threshold: 0,
    operator: '>',
    cooldown_minutes: 30,
    recommended_channels: ['dashboard'],
  },
  {
    name: 'Order Surge — Peak Rush Incoming',
    description: 'Fires when orders-per-minute exceeds 20 (adjust threshold to your capacity)',
    severity: 'info',
    category: 'operations',
    emoji: '🔥',
    metric_sql: `
      SELECT count() AS value
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'OrderPlaced'
        AND timestamp >= now() - INTERVAL 1 MINUTE`,
    threshold: 20,
    operator: '>',
    cooldown_minutes: 10,
    recommended_channels: ['dashboard', 'slack'],
  },

  // ── Revenue ───────────────────────────────────────────────────────────────
  {
    name: 'Daily Revenue Target Hit',
    description: 'Fires when today\'s revenue crosses ₹10,000 — customise threshold to your target',
    severity: 'info',
    category: 'revenue',
    emoji: '🎯',
    metric_sql: `
      SELECT sum(toFloat64OrZero(JSONExtractString(properties, 'amount'))) AS value
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type IN ('PaymentProcessed', 'OrderPlaced')
        AND toDate(timestamp) = today()`,
    threshold: 10000,
    operator: '>=',
    cooldown_minutes: 1440, // once per day
    recommended_channels: ['slack', 'dashboard'],
  },
  {
    name: 'Slow Revenue — Below Hourly Target',
    description: 'Fires when revenue in the past hour is below ₹500 during business hours (10–22h)',
    severity: 'warning',
    category: 'revenue',
    emoji: '📉',
    metric_sql: `
      SELECT
        CASE
          WHEN toHour(now()) BETWEEN 10 AND 22
          THEN sum(toFloat64OrZero(JSONExtractString(properties, 'amount')))
          ELSE 9999999
        END AS value
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type IN ('PaymentProcessed', 'OrderPlaced')
        AND timestamp >= now() - INTERVAL 1 HOUR`,
    threshold: 500,
    operator: '<',
    cooldown_minutes: 60,
    recommended_channels: ['dashboard'],
  },

  // ── Customer Experience ───────────────────────────────────────────────────
  {
    name: 'Negative Review Spike',
    description: 'Fires when 3 or more 1–2 star reviews are submitted within 30 minutes',
    severity: 'warning',
    category: 'experience',
    emoji: '😡',
    metric_sql: `
      SELECT count() AS value
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'ReviewSubmitted'
        AND toUInt8OrZero(JSONExtractString(properties, 'rating')) <= 2
        AND timestamp >= now() - INTERVAL 30 MINUTE`,
    threshold: 2,
    operator: '>',
    cooldown_minutes: 60,
    recommended_channels: ['slack', 'email', 'dashboard'],
  },
  {
    name: 'Payment Failure Spike',
    description: 'Fires when 5+ payment failures occur within 10 minutes',
    severity: 'critical',
    category: 'operations',
    emoji: '💳',
    metric_sql: `
      SELECT count() AS value
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'PaymentFailed'
        AND timestamp >= now() - INTERVAL 10 MINUTE`,
    threshold: 4,
    operator: '>',
    cooldown_minutes: 30,
    recommended_channels: ['slack', 'dashboard'],
  },

  // ── SaaS / Startup ────────────────────────────────────────────────────────
  {
    name: 'Churn Spike — Multiple Cancellations',
    description: 'Fires when 3+ Churned events occur in one hour (startup mode)',
    severity: 'critical',
    category: 'saas',
    emoji: '😰',
    metric_sql: `
      SELECT count() AS value
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'Churned'
        AND timestamp >= now() - INTERVAL 1 HOUR`,
    threshold: 2,
    operator: '>',
    cooldown_minutes: 60,
    recommended_channels: ['slack', 'pagerduty'],
  },
  {
    name: 'New Signup Milestone',
    description: 'Fires when today\'s signups cross 100 — adjust threshold to your goal',
    severity: 'info',
    category: 'saas',
    emoji: '🎉',
    metric_sql: `
      SELECT count() AS value
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'Signup'
        AND toDate(timestamp) = today()`,
    threshold: 100,
    operator: '>=',
    cooldown_minutes: 1440,
    recommended_channels: ['slack'],
  },
]

/**
 * Returns pre-built alert templates filtered by category.
 * Use this to auto-provision alerts when a business tenant signs up.
 */
export function getTemplatesForCategory(
  category: 'cafe' | 'restaurant' | 'startup' | 'all'
): BusinessAlertTemplate[] {
  if (category === 'all') return BUSINESS_ALERT_TEMPLATES
  if (category === 'startup') {
    return BUSINESS_ALERT_TEMPLATES.filter(t =>
      t.category === 'saas' || t.category === 'revenue'
    )
  }
  return BUSINESS_ALERT_TEMPLATES.filter(t =>
    t.category !== 'saas'
  )
}
