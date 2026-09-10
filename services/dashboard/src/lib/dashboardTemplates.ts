/**
 * DASHBOARD_TEMPLATES
 *
 * Maps a businessType to an ordered list of widget IDs to display on /dashboard.
 * Each widget ID corresponds to a component in components/widgets/.
 *
 * To add a new vertical: add one entry here + one file per widget.
 * No other changes needed.
 */

export type BusinessType = 'cafe' | 'restaurant' | 'retail' | 'startup'

export const DASHBOARD_TEMPLATES: Record<BusinessType, string[]> = {
  cafe: [
    'OrdersToday',       // OrderPlaced count today
    'RevenueToday',      // Revenue from OrderPlaced.amount today
    'TableTurnover',     // Avg time between TableOccupied and next for same table
    'TopItems',          // Top items by order count (item_id)
    'StockAlerts',       // StockLow events where current_qty < threshold
    'PaymentMethods',    // PaymentProcessed breakdown by payment_method
    'Reviews',           // ReviewSubmitted avg rating + recent comments
  ],
  restaurant: [
    'OrdersToday',
    'RevenueToday',
    'TableTurnover',
    'TopItems',
    'StockAlerts',
    'Reviews',
    'PaymentMethods',
  ],
  retail: [
    'RevenueToday',      // OrderPlaced revenue
    'OrdersToday',       // Sale count
    'StockAlerts',       // Items below threshold
    'TopCategories',     // OrderPlaced breakdown by category
    'TopItems',          // Best-selling SKUs
    'FootfallTrend',     // Unique user_ids per hour (proxy for footfall)
    'PaymentMethods',
  ],
  startup: [
    'FunnelConversion',  // Signup → Trial → Subscribed funnel (existing /dashboard/funnel data)
    'MRRTrend',          // Sum of mrr_delta from Subscribed + InvoicePaid events
    'ChurnRate',         // Churned events / active subscribers
    'FeatureAdoption',   // FeatureUsed breakdown by feature_name
    'ActiveSessions',    // Open sessions right now
    'ErrorRate',         // Error % from events table
  ],
}

/**
 * PREBUILT_ALERT_TEMPLATES
 *
 * Alert rules auto-created (disabled) when a tenant completes onboarding.
 * active=0 means they appear in the UI but don't fire until the user enables them.
 */
export const PREBUILT_ALERT_TEMPLATES: Record<
  BusinessType,
  Array<{
    metric: string
    operator: 'gt' | 'lt' | 'eq'
    threshold: number
    windowSeconds: number
    label: string
  }>
> = {
  cafe: [
    {
      label: 'Low stock alert',
      metric: 'stock_low_count',
      operator: 'gt',
      threshold: 0,
      windowSeconds: 300,
    },
    {
      label: 'Table occupied > 45 min',
      metric: 'max_table_occupancy_seconds',
      operator: 'gt',
      threshold: 2700,
      windowSeconds: 300,
    },
  ],
  restaurant: [
    {
      label: 'Low stock alert',
      metric: 'stock_low_count',
      operator: 'gt',
      threshold: 0,
      windowSeconds: 300,
    },
    {
      label: 'Table occupied > 45 min',
      metric: 'max_table_occupancy_seconds',
      operator: 'gt',
      threshold: 2700,
      windowSeconds: 300,
    },
  ],
  retail: [
    {
      label: 'Low stock alert',
      metric: 'stock_low_count',
      operator: 'gt',
      threshold: 0,
      windowSeconds: 300,
    },
    {
      label: 'Footfall drop > 50%',
      metric: 'hourly_unique_users_drop_pct',
      operator: 'gt',
      threshold: 50,
      windowSeconds: 3600,
    },
  ],
  startup: [
    {
      label: 'Error rate spike',
      metric: 'error_rate_pct',
      operator: 'gt',
      threshold: 5,
      windowSeconds: 60,
    },
    {
      label: 'Churn rate elevated',
      metric: 'churn_rate_pct',
      operator: 'gt',
      threshold: 10,
      windowSeconds: 86400,
    },
  ],
}

export const BIZ_LABELS: Record<BusinessType, string> = {
  cafe: 'Cafe / Coffee Shop',
  restaurant: 'Restaurant',
  retail: 'Retail / Shop',
  startup: 'SaaS / Startup',
}
