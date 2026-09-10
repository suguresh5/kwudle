import { FastifyInstance } from 'fastify';
import { getTenantId } from '../middleware/auth';
import { queryRows, getClickHouseClient } from '../db/clickhouse';
import { getRedisClient } from '../cache/redis';
import { z } from 'zod';

const SamplingRuleSchema = z.object({
  event_type: z.string().min(1).max(64),
  keep_rate: z.number().min(0).max(1),
  active: z.union([z.literal(0), z.literal(1)]).default(1),
});

/**
 * Invalidates the Redis cache key for a sampling rule so the ingest sampler
 * picks up the change within its next poll cycle (< 1s via direct Redis write).
 */
async function invalidateSamplingCache(tenantId: string, eventType: string) {
  const redis = getRedisClient();
  const key = `sampling_rules:${tenantId}:${eventType}`;
  await redis.del(key);
}


export async function samplingRoutes(fastify: FastifyInstance): Promise<void> {

  /**
   * GET /api/sampling-rules
   * Returns all sampling rules for this tenant (includes global defaults).
   */
  fastify.get('/api/sampling-rules', async (request, _reply) => {
    const tenantId = getTenantId(request);
    const sql = `
      SELECT tenant_id, event_type, keep_rate, active, updated_at
      FROM sentinel.sampling_rules FINAL
      WHERE tenant_id IN ({tenantId:UUID}, '00000000-0000-0000-0000-000000000000')
      ORDER BY tenant_id DESC, event_type ASC`;
    return queryRows(sql, { tenantId });
  });

  /**
   * PUT /api/sampling-rules
   * Upsert a sampling rule for the authenticated tenant.
   * Validates keep_rate ∈ [0,1]. After upsert, invalidates Redis cache so
   * the ingest sampler picks up the change within < 1 second.
   */
  fastify.put('/api/sampling-rules', async (request, reply) => {
    const tenantId = getTenantId(request);
    const body = SamplingRuleSchema.parse(request.body);

    const ch = getClickHouseClient();
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');

    // ReplacingMergeTree — insert a new version row (updated_at is the version column)
    await ch.insert({
      table: 'sentinel.sampling_rules',
      values: [{
        tenant_id: tenantId,
        event_type: body.event_type,
        keep_rate: body.keep_rate,
        active: body.active,
        updated_at: now,
      }],
      format: 'JSONEachRow',
    });

    // Immediate Redis cache invalidation so the change propagates to ingest < 1s
    try {
      await invalidateSamplingCache(tenantId, body.event_type);
    } catch {
      // Non-fatal — sampler will pick up on next 30s refresh cycle
    }

    return reply.status(200).send({
      success: true,
      tenant_id: tenantId,
      event_type: body.event_type,
      keep_rate: body.keep_rate,
      active: body.active,
    });
  });

  /**
   * DELETE /api/sampling-rules/:eventType
   * Deactivates a sampling rule (sets active=0) for the tenant.
   */
  fastify.delete('/api/sampling-rules/:eventType', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { eventType } = request.params as { eventType: string };

    const ch = getClickHouseClient();
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');

    await ch.insert({
      table: 'sentinel.sampling_rules',
      values: [{
        tenant_id: tenantId,
        event_type: eventType,
        keep_rate: 1.0,
        active: 0,
        updated_at: now,
      }],
      format: 'JSONEachRow',
    });

    try {
      await invalidateSamplingCache(tenantId, eventType);
    } catch {}

    return reply.status(200).send({ success: true });
  });
}
