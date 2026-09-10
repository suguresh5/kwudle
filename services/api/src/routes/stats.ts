import { FastifyInstance } from 'fastify';
import { getTenantId } from '../middleware/auth';
import { queryRows } from '../db/clickhouse';
import { getCached, setCached, cacheKey, ttlSeconds } from '../cache/redis';

export async function statsRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /api/stats — DAU, latency percentiles, error rate (from MV)
  fastify.get('/api/stats', async (request, reply) => {
    const tenantId = getTenantId(request);
    const query = request.query as { start?: string; end?: string; env?: string };
    const startDate = query.start || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const endDate = query.end || new Date().toISOString().slice(0, 10);
    const env = query.env || null;
    // FIX #2: isRecent based on startDate window, not endDate (endDate is always ~today)
    const isRecent = (Date.now() - new Date(startDate).getTime()) < 3600000;

    const sql = `
      SELECT
        event_date,
        event_type,
        environment,
        uniqMerge(dau) AS dau,
        countMerge(total_events) AS total_events,
        quantileMerge(0.50)(p50_state) AS p50_ms,
        quantileMerge(0.95)(p95_state) AS p95_ms,
        quantileMerge(0.99)(p99_state) AS p99_ms,
        sumMerge(error_count) AS errors
      FROM sentinel.mv_daily_stats_data
      WHERE tenant_id = {tenantId:UUID}
        AND event_date BETWEEN {startDate:Date} AND {endDate:Date}
        ${env ? 'AND environment = {env:String}' : ''}
      GROUP BY event_date, event_type, environment
      ORDER BY event_date DESC`;

    // FIX #3: include env in cache key so different envs don't share the same cache
    const key = cacheKey(sql + startDate + endDate + (env ?? ''), tenantId);
    const cached = await getCached(key);
    if (cached) {
      reply.header('X-Cache', 'HIT');
      return cached;
    }

    // FIX #1: pass env param to query (only included in SQL if env is set)
    const rows = await queryRows(sql, { tenantId, startDate, endDate, ...(env ? { env } : {}) });
    await setCached(key, rows, ttlSeconds(isRecent));
    reply.header('X-Cache', 'MISS');
    return rows;
  });

  // GET /api/stats/sessions
  fastify.get('/api/stats/sessions', async (request, reply) => {
    const tenantId = getTenantId(request);
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || '100'), 1000);

    const sql = `
      SELECT
        session_id, user_id, session_start, session_end,
        duration_ms, page_depth, event_count, converted,
        entry_page, exit_page, country, device_type
      FROM sentinel.sessions
      WHERE tenant_id = {tenantId:UUID}
      ORDER BY session_start DESC
      LIMIT {limit:UInt32}`;

    const key = cacheKey(sql + limit, tenantId);
    const cached = await getCached(key);
    if (cached) { reply.header('X-Cache', 'HIT'); return cached; }

    const rows = await queryRows(sql, { tenantId, limit });
    await setCached(key, rows, ttlSeconds(false));
    return rows;
  });

  // GET /api/stats/deployments — ASOF JOIN chart data (Feature F)
  fastify.get('/api/stats/deployments', async (request, reply) => {
    const tenantId = getTenantId(request);
    const query = request.query as { env?: string; hours?: string };
    const env = query.env || 'production';
    const hours = Math.min(parseInt(query.hours || '24'), 168);

    // Deployment markers for overlay
    const deploysSql = `
      SELECT version, timestamp, environment, deployed_by, notes
      FROM sentinel.deployments
      WHERE environment = {env:String}
        AND timestamp >= now() - INTERVAL {hours:UInt32} HOUR
      ORDER BY timestamp DESC`;

    // Error rate + latency time series with deployment version via ASOF JOIN
    const timeseriesSql = `
      SELECT
        m.minute_bucket AS minute,
        countMerge(m.total_events) AS total_events,
        sumMerge(m.error_events) AS error_events,
        quantileMerge(0.99)(m.p99_state) AS p99_ms,
        d.version AS deployment_version
      FROM sentinel.mv_error_rate_data m

      ASOF LEFT JOIN sentinel.deployments d
        ON m.environment = d.environment AND m.minute_bucket >= d.timestamp
      WHERE m.tenant_id = {tenantId:UUID}
        AND m.environment = {env:String}
        AND m.minute_bucket >= now() - INTERVAL {hours:UInt32} HOUR
      GROUP BY minute, d.version
      ORDER BY minute ASC`;

    // FIX #4: cache deployments response (30s TTL — recent data)
    const deployKey = cacheKey(deploysSql + timeseriesSql + env + hours, tenantId);
    const deploysCached = await getCached<{ deployments: unknown[]; timeseries: unknown[] }>(deployKey);
    if (deploysCached) {
      reply.header('X-Cache', 'HIT');
      return deploysCached;
    }

    const [deploys, timeseries] = await Promise.all([
      queryRows(deploysSql, { env, hours }),
      queryRows(timeseriesSql, { tenantId, env, hours }),
    ]);

    const deployResult = { deployments: deploys, timeseries };
    await setCached(deployKey, deployResult, 30); // 30s TTL for near-real-time data
    reply.header('X-Cache', 'MISS');
    return deployResult;
  });

  // GET /api/stats/sampling-status
  fastify.get('/api/stats/sampling-status', async (request, _reply) => {
    const tenantId = getTenantId(request);
    const sql = `
      SELECT event_type, keep_rate, active
      FROM sentinel.sampling_rules
      WHERE tenant_id IN ({tenantId:UUID}, '00000000-0000-0000-0000-000000000000')
        AND active = 1
      ORDER BY tenant_id DESC`;
    return queryRows(sql, { tenantId });
  });
}
