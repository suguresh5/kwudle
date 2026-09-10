import { FastifyInstance } from 'fastify';
import { getTenantId } from '../middleware/auth';
import { queryRows } from '../db/clickhouse';
import { getClickHouseClient } from '../db/clickhouse';
import { z } from 'zod';

const CreateAlertSchema = z.object({
  metric: z.string().min(1),
  operator: z.enum(['gt', 'lt', 'eq']),
  threshold: z.number(),
  window_seconds: z.number().int().min(60).max(86400),
  notify_channel: z.string(),
  notify_webhook: z.string().url(),
});

export async function alertRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /api/alerts/rules
  fastify.get('/api/alerts/rules', async (request) => {
    const tenantId = getTenantId(request);
    return queryRows(
      `SELECT id, metric, operator, threshold, window_seconds,
              notify_channel, active, created_at, last_fired_at
       FROM sentinel.alert_rules
       WHERE tenant_id = {tenantId:UUID}
       ORDER BY created_at DESC`,
      { tenantId }
    );
  });

  // POST /api/alerts/rules
  fastify.post('/api/alerts/rules', async (request, reply) => {
    const tenantId = getTenantId(request);
    const body = CreateAlertSchema.parse(request.body);
    const ch = getClickHouseClient();
    const id = crypto.randomUUID();

    await ch.command({
      query: `INSERT INTO sentinel.alert_rules
              (id, tenant_id, metric, operator, threshold, window_seconds,
               notify_channel, notify_webhook, active, created_at)
              VALUES ({id:UUID}, {tenantId:UUID}, {metric:String}, {operator:String},
                      {threshold:Float64}, {window_seconds:UInt32},
                      {notify_channel:String}, {notify_webhook:String}, 1, now64(3))`,
      query_params: { id, tenantId, ...body },
    });

    reply.status(201).send({ id, status: 'created' });
  });

  // DELETE /api/alerts/rules/:id
  fastify.delete('/api/alerts/rules/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params as { id: string };
    const ch = getClickHouseClient();

    await ch.command({
      query: `ALTER TABLE sentinel.alert_rules UPDATE active = 0
              WHERE id = {id:UUID} AND tenant_id = {tenantId:UUID}`,
      query_params: { id, tenantId },
    });

    reply.status(204).send();
  });
}
