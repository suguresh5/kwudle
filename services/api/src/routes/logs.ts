import { FastifyInstance } from 'fastify';
import { getTenantId } from '../middleware/auth';
import { queryRows } from '../db/clickhouse';
import { getCached, setCached, cacheKey } from '../cache/redis';

export async function logsRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /api/logs
  fastify.get('/api/logs', async (request, reply) => {
    const tenantId = getTenantId(request);
    const q = request.query as {
      level?: string;
      service?: string;
      search?: string;
      hours?: string;
      limit?: string;
    };

    const allowedHours = [1, 6, 24, 168];
    const hours  = allowedHours.includes(parseInt(q.hours || '24'))
      ? parseInt(q.hours || '24') : 24;
    const limit  = Math.min(parseInt(q.limit || '200'), 1000);
    const level   = q.level   || '';
    const service = q.service || '';
    const search  = q.search  || '';

    const key = cacheKey(
      `logs:${level}:${service}:${search}:${hours}:${limit}`,
      tenantId
    );
    const cached = await getCached(key);
    if (cached) {
      reply.header('X-Cache', 'HIT');
      return cached;
    }

    const conditions: string[] = [
      'tenant_id = {tenantId:UUID}',
      'timestamp >= now() - INTERVAL {hours:UInt32} HOUR',
    ];
    const params: Record<string, any> = { tenantId, hours, limit };

    if (level)   { conditions.push('level = {level:String}');             params.level = level; }
    if (service) { conditions.push('service = {service:String}');         params.service = service; }
    if (search)  { conditions.push('positionCaseInsensitive(message, {search:String}) > 0'); params.search = search; }

    const sql = `
      SELECT
        timestamp, level, service, message, details, request_id
      FROM sentinel.logs
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32}`;

    const rows = await queryRows(sql, params);
    await setCached(key, rows, 10); // 10-second TTL per spec
    reply.header('X-Cache', 'MISS');
    return rows;
  });
}
