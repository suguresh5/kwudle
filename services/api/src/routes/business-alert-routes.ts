import { FastifyInstance } from 'fastify';
import { BUSINESS_ALERT_TEMPLATES, getTemplatesForCategory } from './business-alerts';

/**
 * Exposes pre-built business alert templates via the API so the dashboard
 * and onboarding wizard can list and provision them.
 */
export async function businessAlertRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /api/business/alert-templates — list all pre-built templates
  fastify.get('/api/business/alert-templates', async (request, _reply) => {
    const q = request.query as { category?: string };
    const category = q.category as 'cafe' | 'restaurant' | 'startup' | 'all' | undefined;
    return getTemplatesForCategory(category ?? 'all');
  });

  // GET /api/business/alert-templates/count — quick count per category
  fastify.get('/api/business/alert-templates/count', async (_request, _reply) => {
    const counts: Record<string, number> = {};
    BUSINESS_ALERT_TEMPLATES.forEach(t => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return { total: BUSINESS_ALERT_TEMPLATES.length, by_category: counts };
  });
}
