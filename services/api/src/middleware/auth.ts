import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { getRedisClient } from '../cache/redis';
import { queryRows } from '../db/clickhouse';

interface ApiKeyRecord {
  tenant_id: string;
  rate_limit_tier: string;
  revoked: number;
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Missing Authorization header' });
    return;
  }
  const rawKey = authHeader.slice(7);
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const cacheKey = `apikey:${keyHash}`;
  const redis = getRedisClient();

  const cached = await redis.get(cacheKey);
  let record: ApiKeyRecord | null = null;

  if (cached) {
    record = JSON.parse(cached);
  } else {
    const rows = await queryRows<ApiKeyRecord>(
      `SELECT tenant_id, rate_limit_tier, revoked
       FROM sentinel.api_keys
       WHERE key_hash = {keyHash:String} AND revoked = 0
       LIMIT 1`,
      { keyHash }
    );
    if (rows.length === 0) {
      reply.status(401).send({ error: 'Invalid or revoked API key' });
      return;
    }
    record = rows[0];
    await redis.setex(cacheKey, 60, JSON.stringify(record));
  }

  if (!record || record.revoked) {
    reply.status(401).send({ error: 'API key revoked' });
    return;
  }
  (request as any).tenantId = record.tenant_id;
}

export function getTenantId(request: FastifyRequest): string {
  return (request as any).tenantId as string;
}
