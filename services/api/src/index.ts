import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { statsRoutes } from './routes/stats';
import { alertRoutes } from './routes/alerts';
import { adminRoutes } from './routes/admin';
import { logsRoutes } from './routes/logs';
import { suggestionsRoutes } from './routes/suggestions';
import { businessRoutes } from './routes/business';
import { businessAlertRoutes } from './routes/business-alert-routes';
import { samplingRoutes } from './routes/sampling';

const fastify = Fastify({ logger: { level: 'info' } });

// ── In-process request counters for Prometheus /metrics ──────────────────────
const counters = {
  requests_total: 0,
  requests_errors_total: 0,
  cache_hits_total: 0,
  cache_misses_total: 0,
};
const startTimeMs = Date.now();

/** Increment a counter by name. Called from route handlers. */
export function incr(counter: keyof typeof counters, by = 1) {
  counters[counter] += by;
}

fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

fastify.get('/health', async () => ({ status: 'ok', service: config.serviceName }));

fastify.get('/metrics', async (_, reply) => {
  reply.type('text/plain; version=0.0.4');
  const uptimeSeconds = ((Date.now() - startTimeMs) / 1000).toFixed(2);
  return [
    '# HELP sentinel_api_up API health (1 = up)',
    '# TYPE sentinel_api_up gauge',
    'sentinel_api_up 1',
    '',
    `# HELP sentinel_api_uptime_seconds Seconds since API process started`,
    '# TYPE sentinel_api_uptime_seconds counter',
    `sentinel_api_uptime_seconds ${uptimeSeconds}`,
    '',
    '# HELP sentinel_api_requests_total Total HTTP requests handled',
    '# TYPE sentinel_api_requests_total counter',
    `sentinel_api_requests_total ${counters.requests_total}`,
    '',
    '# HELP sentinel_api_requests_errors_total Total HTTP 5xx responses',
    '# TYPE sentinel_api_requests_errors_total counter',
    `sentinel_api_requests_errors_total ${counters.requests_errors_total}`,
    '',
    '# HELP sentinel_api_cache_hits_total Total Redis cache hits',
    '# TYPE sentinel_api_cache_hits_total counter',
    `sentinel_api_cache_hits_total ${counters.cache_hits_total}`,
    '',
    '# HELP sentinel_api_cache_misses_total Total Redis cache misses',
    '# TYPE sentinel_api_cache_misses_total counter',
    `sentinel_api_cache_misses_total ${counters.cache_misses_total}`,
    '',
  ].join('\n');
});

// ── Request tracking hook ─────────────────────────────────────────────────────
fastify.addHook('onResponse', async (request, reply) => {
  incr('requests_total');
  if (reply.statusCode >= 500) {
    incr('requests_errors_total');
  }
});

fastify.addHook('preHandler', async (request, reply) => {
  const path = request.url;
  if (path === '/health' || path === '/metrics') return;
  if (path.startsWith('/admin')) return;
  await authMiddleware(request, reply);
});

fastify.register(statsRoutes);
fastify.register(alertRoutes);
fastify.register(adminRoutes);
fastify.register(logsRoutes);
fastify.register(suggestionsRoutes);
fastify.register(businessRoutes);
fastify.register(businessAlertRoutes);
fastify.register(samplingRoutes);

const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
