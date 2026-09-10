import { FastifyInstance } from 'fastify';
import { getTenantId } from '../middleware/auth';
import { queryRows, getClickHouseClient } from '../db/clickhouse';

export async function suggestionsRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /api/suggestions — list all active suggestions for tenant
  fastify.get('/api/suggestions', async (request) => {
    const tenantId = getTenantId(request);
    const rows = await queryRows(
      `SELECT id, category, priority, title, problem, suggestion,
              expected_impact, data_evidence, status, generated_at
       FROM sentinel.suggestions
       WHERE tenant_id = {tenantId:UUID} AND status = 'active'
       ORDER BY
         multiIf(priority='HIGH',0, priority='MEDIUM',1, 2) ASC,
         generated_at DESC`,
      { tenantId }
    );
    return rows;
  });

  // PATCH /api/suggestions/:id/done
  fastify.patch('/api/suggestions/:id/done', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params as { id: string };
    const ch = getClickHouseClient();
    await ch.command({
      query: `ALTER TABLE sentinel.suggestions UPDATE status = 'done'
              WHERE id = {id:UUID} AND tenant_id = {tenantId:UUID}`,
      query_params: { id, tenantId },
    });
    reply.status(200).send({ success: true });
  });

  // PATCH /api/suggestions/:id/dismiss
  fastify.patch('/api/suggestions/:id/dismiss', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params as { id: string };
    const ch = getClickHouseClient();
    await ch.command({
      query: `ALTER TABLE sentinel.suggestions UPDATE status = 'dismissed'
              WHERE id = {id:UUID} AND tenant_id = {tenantId:UUID}`,
      query_params: { id, tenantId },
    });
    reply.status(200).send({ success: true });
  });
}
