import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom metrics
const ingestLatency = new Trend('ingest_latency_ms');
const droppedRate = new Rate('events_dropped_rate');
const eventsSent = new Counter('events_sent_total');

const BASE_URL = __ENV.INGEST_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'kwudle-loadtest-api-key';

// Multi-tenant pool
const TENANTS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
];

const EVENT_TYPES = [
  { type: 'PageView', weight: 0.70 },
  { type: 'FeatureUsed', weight: 0.15 },
  { type: 'AddToCart', weight: 0.10 },
  { type: 'Purchase', weight: 0.05 },
];

function pickEventType() {
  const r = Math.random();
  let cumulative = 0;
  for (const ev of EVENT_TYPES) {
    cumulative += ev.weight;
    if (r <= cumulative) {
      return ev.type;
    }
  }
  return 'PageView';
}

function randomUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const options = {
  scenarios: {
    // Normal baseline ramp
    baseline: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { target: 500, duration: '20s' },   // ramp to 500 req/s
        { target: 1000, duration: '40s' },  // sustain 1000 req/s
        { target: 2500, duration: '30s' },  // spike to 2500 req/s to trigger sampler
        { target: 100, duration: '20s' },   // ramp down
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],        // < 1% errors
    http_req_duration: ['p(95)<150'],      // 95% of requests under 150ms
    http_req_duration: ['p(99)<300'],      // 99% of requests under 300ms
  },
};

export default function () {
  const tenantId = TENANTS[Math.floor(Math.random() * TENANTS.length)];
  const eventType = pickEventType();
  const userId = `usr_${Math.floor(Math.random() * 5000)}`;

  const payload = JSON.stringify({
    event_id: randomUUID(),
    tenant_id: tenantId,
    user_id: userId,
    event_type: eventType,
    timestamp: new Date().toISOString(),
    raw_ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    raw_email: `${userId}@example.com`,
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    properties: {
      page: eventType === 'PageView' ? '/dashboard/analytics' : undefined,
      order_value: eventType === 'Purchase' ? (Math.random() * 200 + 10).toFixed(2) : undefined,
      browser_locale: 'en-US',
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    timeout: '5s',
  };

  const start = Date.now();
  const res = http.post(`${BASE_URL}/v1/events`, payload, params);
  const duration = Date.now() - start;

  ingestLatency.add(duration);
  eventsSent.add(1);

  const passed = check(res, {
    'status is 200 or 202': (r) => r.status === 200 || r.status === 202,
  });

  if (!passed) {
    droppedRate.add(1);
  } else {
    droppedRate.add(0);
  }
}
