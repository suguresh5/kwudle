import { FastifyInstance } from 'fastify';
import { queryRows, getClickHouseClient } from '../db/clickhouse';
import crypto from 'crypto';
import { z } from 'zod';

const CreateTenantSchema = z.object({
  name: z.string().min(1),
  tier: z.enum(['free', 'pro', 'enterprise']).default('free'),
});

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /admin/tenants
  fastify.post('/admin/tenants', async (request, reply) => {
    const body = CreateTenantSchema.parse(request.body);
    const tenantId = crypto.randomUUID();
    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const ch = getClickHouseClient();

    await ch.command({
      query: `INSERT INTO sentinel.api_keys
              (key_hash, tenant_id, name, rate_limit_tier, created_at, revoked)
              VALUES ({keyHash:String}, {tenantId:UUID}, {name:String},
                      {tier:String}, now64(3), 0)`,
      query_params: { keyHash, tenantId, name: body.name, tier: body.tier },
    });

    // Return raw key ONCE — never stored, never retrievable again
    reply.status(201).send({ tenant_id: tenantId, api_key: rawKey, tier: body.tier });
  });

  // DELETE /admin/api-keys/:id
  fastify.delete('/admin/api-keys/:keyHash', async (request, reply) => {
    const { keyHash } = request.params as { keyHash: string };
    const ch = getClickHouseClient();

    await ch.command({
      query: `ALTER TABLE sentinel.api_keys UPDATE revoked = 1
              WHERE key_hash = {keyHash:String}`,
      query_params: { keyHash },
    });

    reply.status(204).send();
  });

  // POST /admin/dlq/replay — proxied to ingest service
  fastify.post('/admin/dlq/replay', async (request, reply) => {
    const ingestURL = process.env.INGEST_URL || 'http://sentinel-ingest:8080';
    const resp = await fetch(`${ingestURL}/admin/dlq/replay`, { method: 'POST' });
    reply.status(resp.status).send(await resp.json());
  });

  /**
   * POST /admin/api-keys/:keyHash/rotate
   *
   * Issues a new API key for the same tenant.
   * Sets a 24-hour grace period on the old key in Redis so in-flight requests
   * using the old key continue to succeed during the rotation window.
   *
   * Returns: { new_api_key, tenant_id, grace_expires_at }
   * The new_api_key is shown ONCE — never stored, never retrievable again.
   */
  fastify.post('/admin/api-keys/:keyHash/rotate', async (request, reply) => {
    const { keyHash } = request.params as { keyHash: string };
    const ch = getClickHouseClient();

    // Look up the old key's tenant
    const rows = await queryRows<{ tenant_id: string; rate_limit_tier: string }>(
      `SELECT tenant_id, rate_limit_tier FROM sentinel.api_keys FINAL
       WHERE key_hash = {keyHash:String} AND revoked = 0 LIMIT 1`,
      { keyHash }
    );
    if (!rows.length) return reply.status(404).send({ error: 'Key not found or already revoked' });

    const { tenant_id, rate_limit_tier } = rows[0];

    // Issue new key
    const newRaw = crypto.randomBytes(32).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRaw).digest('hex');

    await ch.command({
      query: `INSERT INTO sentinel.api_keys (key_hash, tenant_id, name, rate_limit_tier, created_at, revoked)
              VALUES ({newHash:String}, {tenantId:UUID}, 'rotated', {tier:String}, now64(3), 0)`,
      query_params: { newHash, tenantId: tenant_id, tier: rate_limit_tier },
    });

    // Revoke old key in ClickHouse
    await ch.command({
      query: `ALTER TABLE sentinel.api_keys UPDATE revoked = 1 WHERE key_hash = {keyHash:String}`,
      query_params: { keyHash },
    });

    // Redis: write grace-period key for old hash (24h TTL)
    const { getRedisClient } = await import('../cache/redis');
    const redis = getRedisClient();
    if (redis) {
      const graceKey = `grace:apikey:${keyHash}`;
      await redis.set(graceKey, tenant_id, 'EX', 86400); // 24 hours
    }

    const graceExpiresAt = new Date(Date.now() + 86400000).toISOString();

    return reply.status(201).send({
      new_api_key: newRaw,
      tenant_id,
      grace_expires_at: graceExpiresAt,
      message: 'Old key will continue working for 24h (grace period). Store the new key securely — it cannot be retrieved again.',
    });
  });
}

