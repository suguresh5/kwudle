import { FastifyInstance } from 'fastify';
import { getTenantId } from '../middleware/auth';
import { queryRows } from '../db/clickhouse';
import { getCached, setCached, cacheKey, ttlSeconds } from '../cache/redis';

/**
 * Business Analytics Routes
 *
 * Domain-specific endpoints for cafes, restaurants, and SaaS startups.
 * All queries run against the same sentinel.events table, using ClickHouse's
 * JSONExtract functions to access schemaless properties.
 *
 * Endpoints:
 *   GET /api/business/revenue         — hourly/daily revenue + avg order value
 *   GET /api/business/top-items       — best-selling menu items
 *   GET /api/business/peak-hours      — order heatmap by hour × weekday
 *   GET /api/business/table-turnover  — avg occupancy time per table
 *   GET /api/business/customer-loyalty— repeat rate, visit frequency
 *   GET /api/business/stock           — items below threshold right now
 *   GET /api/business/live            — open orders + occupied tables NOW
 *   GET /api/business/reviews         — recent ratings + avg score
 *   GET /api/business/saas            — MRR, churn, funnel (startup mode)
 *   GET /api/business/locations       — Multi-branch performance
 */
export async function businessRoutes(fastify: FastifyInstance): Promise<void> {

  // ── Revenue Overview ────────────────────────────────────────────────────────
  fastify.get('/api/business/revenue', async (request, reply) => {
    const tenantId = getTenantId(request);
    const q = request.query as { days?: string; location?: string; granularity?: string };
    const days = Math.min(parseInt(q.days || '30'), 365);
    const location = q.location || null;
    const granularity = q.granularity === 'hour' ? 'hour' : 'day';

    const bucketExpr = granularity === 'hour'
      ? `toStartOfHour(timestamp)`
      : `toDate(timestamp)`;

    const sql = `
      SELECT
        ${bucketExpr}                                                   AS bucket,
        count()                                                         AS order_count,
        sum(toFloat64OrZero(JSONExtractString(properties, 'amount')))   AS revenue,
        avg(toFloat64OrZero(JSONExtractString(properties, 'amount')))   AS avg_order_value,
        uniq(user_id)                                                   AS unique_customers
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'OrderPlaced'
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
        ${location ? "AND JSONExtractString(properties, 'location_id') = {location:String}" : ''}
      GROUP BY bucket
      ORDER BY bucket ASC`;

    const key = cacheKey(sql + days + granularity + (location ?? ''), tenantId);
    const cached = await getCached(key);
    if (cached) { reply.header('X-Cache', 'HIT'); return cached; }

    const rows = await queryRows(sql, { tenantId, days, ...(location ? { location } : {}) });
    await setCached(key, rows, ttlSeconds(days <= 1));
    reply.header('X-Cache', 'MISS');
    return rows;
  });

  // ── Top Selling Items ───────────────────────────────────────────────────────
  fastify.get('/api/business/top-items', async (request, reply) => {
    const tenantId = getTenantId(request);
    const q = request.query as { days?: string; location?: string; limit?: string; category?: string };
    const days = Math.min(parseInt(q.days || '30'), 365);
    const limit = Math.min(parseInt(q.limit || '10'), 50);
    const location = q.location || null;
    const category = q.category || null;

    const sql = `
      SELECT
        JSONExtractString(properties, 'item_id')                        AS item_id,
        JSONExtractString(properties, 'category')                       AS category,
        count()                                                         AS order_count,
        sum(toFloat64OrZero(JSONExtractString(properties, 'amount')))   AS total_revenue,
        avg(toFloat64OrZero(JSONExtractString(properties, 'amount')))   AS avg_price
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'OrderPlaced'
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
        ${location ? "AND JSONExtractString(properties, 'location_id') = {location:String}" : ''}
        ${category ? "AND JSONExtractString(properties, 'category') = {category:String}" : ''}
        AND JSONExtractString(properties, 'item_id') != ''
      GROUP BY item_id, category
      ORDER BY total_revenue DESC
      LIMIT {limit:UInt32}`;

    const key = cacheKey(sql + days + limit + (location ?? '') + (category ?? ''), tenantId);
    const cached = await getCached(key);
    if (cached) { reply.header('X-Cache', 'HIT'); return cached; }

    const rows = await queryRows(sql, {
      tenantId, days, limit,
      ...(location ? { location } : {}),
      ...(category ? { category } : {}),
    });
    await setCached(key, rows, 120);
    reply.header('X-Cache', 'MISS');
    return rows;
  });

  // ── Peak Hours Heatmap ──────────────────────────────────────────────────────
  fastify.get('/api/business/peak-hours', async (request, reply) => {
    const tenantId = getTenantId(request);
    const q = request.query as { weeks?: string; location?: string };
    const weeks = Math.min(parseInt(q.weeks || '4'), 26);
    const location = q.location || null;

    const sql = `
      SELECT
        toDayOfWeek(timestamp)  AS day_of_week,
        toHour(timestamp)       AS hour_of_day,
        count()                 AS order_count,
        sum(toFloat64OrZero(JSONExtractString(properties, 'amount'))) AS revenue
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'OrderPlaced'
        AND timestamp >= now() - INTERVAL {weeks:UInt32} WEEK
        ${location ? "AND JSONExtractString(properties, 'location_id') = {location:String}" : ''}
      GROUP BY day_of_week, hour_of_day
      ORDER BY day_of_week, hour_of_day`;

    const key = cacheKey(sql + weeks + (location ?? ''), tenantId);
    const cached = await getCached(key);
    if (cached) { reply.header('X-Cache', 'HIT'); return cached; }

    const rows = await queryRows(sql, { tenantId, weeks, ...(location ? { location } : {}) });
    await setCached(key, rows, 300);
    reply.header('X-Cache', 'MISS');
    return rows;
  });

  // ── Table Turnover ──────────────────────────────────────────────────────────
  fastify.get('/api/business/table-turnover', async (request, reply) => {
    const tenantId = getTenantId(request);
    const q = request.query as { days?: string; location?: string };
    const days = Math.min(parseInt(q.days || '7'), 90);
    const location = q.location || null;

    const sql = `
      SELECT
        JSONExtractString(properties, 'table_id')                                   AS table_id,
        count()                                                                     AS sessions,
        avg(toFloat64OrZero(JSONExtractString(properties, 'duration_minutes')))     AS avg_duration_min,
        max(toFloat64OrZero(JSONExtractString(properties, 'duration_minutes')))     AS max_duration_min
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'TableFreed'
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
        ${location ? "AND JSONExtractString(properties, 'location_id') = {location:String}" : ''}
        AND JSONExtractString(properties, 'table_id') != ''
      GROUP BY table_id
      ORDER BY sessions DESC`;

    const key = cacheKey(sql + days + (location ?? ''), tenantId);
    const cached = await getCached(key);
    if (cached) { reply.header('X-Cache', 'HIT'); return cached; }

    const rows = await queryRows(sql, { tenantId, days, ...(location ? { location } : {}) });
    await setCached(key, rows, 120);
    reply.header('X-Cache', 'MISS');
    return rows;
  });

  // ── Customer Loyalty ────────────────────────────────────────────────────────
  fastify.get('/api/business/customer-loyalty', async (request, reply) => {
    const tenantId = getTenantId(request);
    const q = request.query as { days?: string; location?: string };
    const days = Math.min(parseInt(q.days || '30'), 365);
    const location = q.location || null;

    const sql = `
      SELECT
        countIf(visit_count = 1)              AS new_customers,
        countIf(visit_count > 1)              AS returning_customers,
        avg(visit_count)                      AS avg_visits_per_customer,
        avg(total_spent)                      AS avg_lifetime_value,
        countIf(visit_count >= 5)             AS loyal_customers
      FROM (
        SELECT
          user_id,
          count()                                                                 AS visit_count,
          sum(toFloat64OrZero(JSONExtractString(properties, 'amount')))          AS total_spent
        FROM sentinel.events
        WHERE tenant_id = {tenantId:UUID}
          AND event_type = 'OrderPlaced'
          AND timestamp >= now() - INTERVAL {days:UInt32} DAY
          ${location ? "AND JSONExtractString(properties, 'location_id') = {location:String}" : ''}
          AND user_id != ''
        GROUP BY user_id
      )`;

    const key = cacheKey(sql + days + (location ?? ''), tenantId);
    const cached = await getCached(key);
    if (cached) { reply.header('X-Cache', 'HIT'); return cached; }

    const rows = await queryRows(sql, { tenantId, days, ...(location ? { location } : {}) });
    await setCached(key, rows, 300);
    reply.header('X-Cache', 'MISS');
    return rows;
  });

  // ── Stock / Inventory Alerts ────────────────────────────────────────────────
  fastify.get('/api/business/stock', async (request, reply) => {
    const tenantId = getTenantId(request);
    const q = request.query as { location?: string; include_ok?: string };
    const location = q.location || null;
    const includeOk = q.include_ok === 'true';

    const sql = `
      SELECT
        JSONExtractString(properties, 'item_id')                                AS item_id,
        JSONExtractString(properties, 'category')                               AS category,
        JSONExtractString(properties, 'unit')                                   AS unit,
        toFloat64OrZero(anyLast(JSONExtractString(properties, 'current_qty')))  AS current_qty,
        toFloat64OrZero(anyLast(JSONExtractString(properties, 'threshold')))    AS threshold,
        anyLast(event_type)                                                     AS status,
        max(timestamp)                                                          AS last_updated
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type IN ('StockLow', 'StockOut', 'StockReplenished')
        AND timestamp >= now() - INTERVAL 24 HOUR
        ${location ? "AND JSONExtractString(properties, 'location_id') = {location:String}" : ''}
        AND JSONExtractString(properties, 'item_id') != ''
      GROUP BY item_id, category, unit
      ${includeOk ? '' : "HAVING status IN ('StockLow','StockOut')"}
      ORDER BY status DESC, current_qty ASC`;

    const key = cacheKey(sql + (location ?? '') + includeOk, tenantId);
    const cached = await getCached(key);
    if (cached) { reply.header('X-Cache', 'HIT'); return cached; }

    const rows = await queryRows(sql, { tenantId, ...(location ? { location } : {}) });
    await setCached(key, rows, 30);
    reply.header('X-Cache', 'MISS');
    return rows;
  });

  // ── Live Operations (Real-time NOW) ────────────────────────────────────────
  fastify.get('/api/business/live', async (request, reply) => {
    const tenantId = getTenantId(request);
    const q = request.query as { location?: string };
    const location = q.location || null;

    const openOrdersSql = `
      SELECT
        JSONExtractString(properties, 'order_id')   AS order_id,
        JSONExtractString(properties, 'table_id')   AS table_id,
        JSONExtractString(properties, 'items')      AS items,
        toFloat64OrZero(JSONExtractString(properties, 'amount')) AS amount,
        timestamp                                   AS placed_at,
        dateDiff('minute', timestamp, now())        AS waiting_minutes
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'OrderPlaced'
        AND timestamp >= now() - INTERVAL 2 HOUR
        ${location ? "AND JSONExtractString(properties, 'location_id') = {location:String}" : ''}
        AND JSONExtractString(properties, 'order_id') NOT IN (
          SELECT JSONExtractString(properties, 'order_id')
          FROM sentinel.events
          WHERE tenant_id = {tenantId:UUID}
            AND event_type = 'PaymentProcessed'
            AND timestamp >= now() - INTERVAL 2 HOUR
        )
      ORDER BY timestamp ASC
      LIMIT 50`;

    const occupiedTablesSql = `
      SELECT
        JSONExtractString(properties, 'table_id')   AS table_id,
        JSONExtractString(properties, 'party_size') AS party_size,
        timestamp                                   AS since,
        dateDiff('minute', timestamp, now())        AS minutes_occupied
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'TableOccupied'
        AND timestamp >= now() - INTERVAL 4 HOUR
        ${location ? "AND JSONExtractString(properties, 'location_id') = {location:String}" : ''}
        AND JSONExtractString(properties, 'table_id') NOT IN (
          SELECT JSONExtractString(properties, 'table_id')
          FROM sentinel.events
          WHERE tenant_id = {tenantId:UUID}
            AND event_type = 'TableFreed'
            AND timestamp >= now() - INTERVAL 4 HOUR
        )
      ORDER BY timestamp ASC`;

    const todayRevenueSql = `
      SELECT
        count()                                                                 AS orders_today,
        sum(toFloat64OrZero(JSONExtractString(properties, 'amount')))          AS revenue_today,
        avg(toFloat64OrZero(JSONExtractString(properties, 'amount')))          AS avg_order_today
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'PaymentProcessed'
        AND toDate(timestamp) = today()
        ${location ? "AND JSONExtractString(properties, 'location_id') = {location:String}" : ''}`;

    const params = { tenantId, ...(location ? { location } : {}) };
    const key = cacheKey(openOrdersSql + occupiedTablesSql + todayRevenueSql + (location ?? ''), tenantId);
    const cached = await getCached<{ openOrders: unknown[]; occupiedTables: unknown[]; todayStats: unknown[] }>(key);
    if (cached) { reply.header('X-Cache', 'HIT'); return cached; }

    const [openOrders, occupiedTables, todayStats] = await Promise.all([
      queryRows(openOrdersSql, params),
      queryRows(occupiedTablesSql, params),
      queryRows(todayRevenueSql, params),
    ]);

    const result = { openOrders, occupiedTables, todayStats: todayStats[0] ?? {} };
    await setCached(key, result, 15);
    reply.header('X-Cache', 'MISS');
    return result;
  });

  // ── Recent Reviews ──────────────────────────────────────────────────────────
  fastify.get('/api/business/reviews', async (request, reply) => {
    const tenantId = getTenantId(request);
    const q = request.query as { days?: string; min_rating?: string; location?: string };
    const days = Math.min(parseInt(q.days || '7'), 90);
    const minRating = parseInt(q.min_rating || '1');
    const location = q.location || null;

    const sql = `
      SELECT
        toUInt8OrZero(JSONExtractString(properties, 'rating'))   AS rating,
        JSONExtractString(properties, 'comment')                 AS comment,
        JSONExtractString(properties, 'order_id')                AS order_id,
        user_id,
        timestamp
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'ReviewSubmitted'
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
        ${location ? "AND JSONExtractString(properties, 'location_id') = {location:String}" : ''}
        AND toUInt8OrZero(JSONExtractString(properties, 'rating')) >= {minRating:UInt8}
      ORDER BY timestamp DESC
      LIMIT 100`;

    const avgSql = `
      SELECT
        avg(toFloat64OrZero(JSONExtractString(properties, 'rating')))         AS avg_rating,
        countIf(toUInt8OrZero(JSONExtractString(properties, 'rating')) >= 4) AS positive,
        countIf(toUInt8OrZero(JSONExtractString(properties, 'rating')) <= 2) AS negative,
        count() AS total
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'ReviewSubmitted'
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
        ${location ? "AND JSONExtractString(properties, 'location_id') = {location:String}" : ''}`;

    const params = { tenantId, days, minRating, ...(location ? { location } : {}) };
    const key = cacheKey(sql + avgSql + days + minRating + (location ?? ''), tenantId);
    const cached = await getCached(key);
    if (cached) { reply.header('X-Cache', 'HIT'); return cached; }

    const [reviews, summary] = await Promise.all([
      queryRows(sql, params),
      queryRows(avgSql, params),
    ]);

    const result = { reviews, summary: summary[0] ?? {} };
    await setCached(key, result, 120);
    reply.header('X-Cache', 'MISS');
    return result;
  });

  // ── SaaS / Startup Metrics ──────────────────────────────────────────────────
  fastify.get('/api/business/saas', async (request, reply) => {
    const tenantId = getTenantId(request);
    const q = request.query as { days?: string };
    const days = Math.min(parseInt(q.days || '30'), 365);

    const mrrSql = `
      SELECT
        toStartOfMonth(timestamp)                                               AS month,
        sum(toFloat64OrZero(JSONExtractString(properties, 'mrr_delta')))        AS mrr,
        count()                                                                 AS invoice_count
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'InvoicePaid'
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
      GROUP BY month
      ORDER BY month ASC`;

    const funnelSql = `
      SELECT
        event_type,
        count() AS count
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type IN ('Signup','TrialStarted','Subscribed','Churned')
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
      GROUP BY event_type`;

    const featureSql = `
      SELECT
        JSONExtractString(properties, 'feature_name')   AS feature,
        count()                                         AS uses,
        uniq(user_id)                                   AS unique_users
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'FeatureUsed'
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
        AND JSONExtractString(properties, 'feature_name') != ''
      GROUP BY feature
      ORDER BY uses DESC
      LIMIT 20`;

    const params = { tenantId, days };
    const key = cacheKey(mrrSql + funnelSql + featureSql + days, tenantId);
    const cached = await getCached(key);
    if (cached) { reply.header('X-Cache', 'HIT'); return cached; }

    const [mrr, funnel, features] = await Promise.all([
      queryRows(mrrSql, params),
      queryRows(funnelSql, params),
      queryRows(featureSql, params),
    ]);

    const result = { mrr, funnel, features };
    await setCached(key, result, 300);
    reply.header('X-Cache', 'MISS');
    return result;
  });

  // ── Locations summary ───────────────────────────────────────────────────────
  fastify.get('/api/business/locations', async (request, reply) => {
    const tenantId = getTenantId(request);
    const q = request.query as { days?: string };
    const days = Math.min(parseInt(q.days || '7'), 90);

    const sql = `
      SELECT
        JSONExtractString(properties, 'location_id')                            AS location_id,
        count()                                                                 AS order_count,
        sum(toFloat64OrZero(JSONExtractString(properties, 'amount')))           AS revenue,
        uniq(user_id)                                                           AS unique_customers,
        avg(toFloat64OrZero(JSONExtractString(properties, 'amount')))           AS avg_order_value
      FROM sentinel.events
      WHERE tenant_id = {tenantId:UUID}
        AND event_type = 'OrderPlaced'
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
        AND JSONExtractString(properties, 'location_id') != ''
      GROUP BY location_id
      ORDER BY revenue DESC`;

    const key = cacheKey(sql + days, tenantId);
    const cached = await getCached(key);
    if (cached) { reply.header('X-Cache', 'HIT'); return cached; }

    const rows = await queryRows(sql, { tenantId, days });
    await setCached(key, rows, 120);
    reply.header('X-Cache', 'MISS');
    return rows;
  });
}
