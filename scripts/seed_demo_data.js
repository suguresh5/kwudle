const crypto = require('crypto')

const CH_HOST = process.env.CLICKHOUSE_HOST ? `http://${process.env.CLICKHOUSE_HOST}:8123` : 'http://localhost:8123'
const CH_USER = process.env.CLICKHOUSE_USER || 'sentinel_user'
const CH_PASS = process.env.CLICKHOUSE_PASSWORD || 'sxbTelAyMsHnPmGYHGHwA'

const TENANTS = [
  '77f2888c-5c59-4b65-a6f2-d89812525694',
  'd965352b-88be-475b-9efa-2d614fb39f77'
]

async function chExec(sql) {
  const res = await fetch(`${CH_HOST}/`, {
    method: 'POST',
    body: sql,
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${CH_USER}:${CH_PASS}`).toString('base64'),
    }
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`ClickHouse error (${res.status}): ${txt}`)
  }
}


async function chInsertRows(table, columns, rows) {
  if (rows.length === 0) return
  const formattedRows = rows.map(row => '(' + row.map(v => {
    if (v === null || v === undefined) return 'NULL'
    if (typeof v === 'number') return v
    if (typeof v === 'boolean') return v ? 1 : 0
    return "'" + String(v).replace(/'/g, "''").replace(/\\/g, '\\\\') + "'"
  }).join(',') + ')').join(',\n')

  const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES\n${formattedRows}`
  await chExec(sql)
}

function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

const CITIES = [
  { city: 'Mumbai', country: 'IN', isp: 'Jio' },
  { city: 'Delhi', country: 'IN', isp: 'Airtel' },
  { city: 'Bengaluru', country: 'IN', isp: 'ACT Fibernet' },
  { city: 'New York', country: 'US', isp: 'Verizon' },
  { city: 'San Francisco', country: 'US', isp: 'Comcast' },
  { city: 'London', country: 'GB', isp: 'BT' },
  { city: 'Berlin', country: 'DE', isp: 'Telekom' },
  { city: 'Tokyo', country: 'JP', isp: 'NTT' },
  { city: 'Paris', country: 'FR', isp: 'Orange' },
]

const BROWSERS = [
  { browser: 'Chrome', version: '122.0', os: 'macOS', device: 'desktop' },
  { browser: 'Chrome', version: '122.0', os: 'Windows', device: 'desktop' },
  { browser: 'Safari', version: '17.3', os: 'macOS', device: 'desktop' },
  { browser: 'Safari', version: '17.2', os: 'iOS', device: 'mobile' },
  { browser: 'Chrome', version: '121.0', os: 'Android', device: 'mobile' },
  { browser: 'Firefox', version: '123.0', os: 'Linux', device: 'desktop' },
]

const net = require('net')

function resp(arr) {
  return '*' + arr.length + '\r\n' + arr.map(s => '$' + Buffer.byteLength(s) + '\r\n' + s + '\r\n').join('')
}

async function seedRedisKeys() {
  return new Promise((resolve) => {
    const client = net.connect(6379, 'localhost', () => {
      const redisPass = process.env.REDIS_PASSWORD || '1H0mkDrLaXbtdLtUg8qyFQ'
      client.write(resp(['AUTH', redisPass]))
      const v1 = JSON.stringify({ tenant_id: '77f2888c-5c59-4b65-a6f2-d89812525694', rate_limit_tier: 'pro', revoked: false })
      const k1 = 'apikey:6c9c1553a363d2409d009f5678a09e11d5da974500c8072cf6fe858cd8adb676'
      client.write(resp(['SET', k1, v1]))
      const v2 = JSON.stringify({ tenant_id: 'd965352b-88be-475b-9efa-2d614fb39f77', rate_limit_tier: 'pro', revoked: false })
      const k2 = 'apikey:eaccce42d77f70626eb53cf8510216056bacdbbed95c1f734600f4f6896fbb3f'
      client.write(resp(['SET', k2, v2]))
    })
    client.on('data', () => { client.end(); resolve() })
    client.on('error', () => resolve())
  })
}

const SERVICES = ['sentinel-api', 'sentinel-ingest', 'auth-service', 'payment-gateway', 'dashboard']
const PAGES = ['/', '/pricing', '/features', '/docs', '/login', '/signup', '/checkout', '/dashboard']

async function seed() {
  console.log('🌱 Seeding Kwudle Observability Demo Data…\n')
  await seedRedisKeys()


  for (const tenantId of TENANTS) {
    console.log(`📌 Seeding tenant ${tenantId}…`)

    // 1. API Keys
    await chInsertRows('sentinel.api_keys', ['key_hash', 'tenant_id', 'name', 'rate_limit_tier', 'created_at', 'revoked'], [
      ['6e3df3d7f06c3afe830c15c9945dbfd480e65e54dd74d734e4dd12611eeaf1d7', tenantId, 'Default Production Key', 'pro', '2026-01-01 00:00:00', 0],
      ['605cd1e5e1670baf4eefb22eae17154f5c29f159e38d8e342a0b2e9f6d32d939', tenantId, 'Admin Master Key', 'enterprise', '2026-01-01 00:00:00', 0],
    ]).catch(() => {})

function fmtDate(d) {
  return new Date(d).toISOString().slice(0, 19).replace('T', ' ')
}

    // 2. Events (past 14 days)
    const now = Date.now()
    const FourteenDaysMs = 14 * 24 * 60 * 60 * 1000
    const events = []

    const eventTypes = ['PageView', 'PageView', 'PageView', 'ButtonClick', 'ButtonClick', 'Search', 'Login', 'CheckoutStart', 'Purchase', 'ApiError']
    const users = Array.from({ length: 60 }, (_, i) => `user_${100 + i}`)

    for (let i = 0; i < 800; i++) {
      const timeOffset = Math.floor(Math.pow(Math.random(), 1.2) * FourteenDaysMs)
      const eventTime = fmtDate(now - timeOffset)
      const loc = randItem(CITIES)
      const dev = randItem(BROWSERS)
      const evType = randItem(eventTypes)
      const userId = randItem(users)
      const isErr = evType === 'ApiError' || Math.random() < 0.05
      const statusCode = isErr ? randItem([400, 404, 500, 503]) : randItem([200, 200, 200, 201, 204])
      const errorCode = statusCode >= 500 ? 'ERR_INTERNAL' : statusCode >= 400 ? 'ERR_CLIENT' : ''
      const latency = isErr ? randFloat(400, 2500) : randFloat(15, 250)

      let props = '{}'
      if (evType === 'Purchase') {
        props = JSON.stringify({ amount: randItem([49, 99, 199, 299]), currency: 'USD', plan: randItem(['starter', 'pro', 'enterprise']) })
      } else if (evType === 'PageView') {
        props = JSON.stringify({ path: randItem(PAGES), referrer: 'google.com' })
      } else if (evType === 'ButtonClick') {
        props = JSON.stringify({ element_id: 'btn-cta-upgrade', label: 'Upgrade Now' })
      }

      const envName = randItem(['production', 'production', 'production', 'staging', 'development'])

      events.push([
        crypto.randomUUID(),
        tenantId,
        evType,
        eventTime,
        userId,
        `sess_${userId}_${Math.floor(i / 5)}`,
        `anon_${i}`,
        'hash_ip_123',
        'hash_email_456',
        loc.country,
        loc.city,
        loc.isp,
        dev.browser,
        dev.version,
        dev.os,
        dev.device,
        latency,
        errorCode,
        statusCode,
        `tr_${i}`,
        `sp_${i}`,
        `sp_parent_${i}`,
        randItem(SERVICES),
        1.0,
        envName,
        props,
        eventTime,
        'sentinel-ingest'
      ])
    }

    await chInsertRows('sentinel.events', [
      'event_id', 'tenant_id', 'event_type', 'timestamp', 'user_id', 'session_id',
      'anonymous_id', 'ip_address_hash', 'email_hash', 'country', 'city', 'isp',
      'browser', 'browser_version', 'os', 'device_type', 'latency_ms', 'error_code',
      'status_code', 'trace_id', 'span_id', 'parent_span_id', 'service_name',
      'sampling_rate', 'deployment_env', 'properties', 'received_at', 'ingested_by'
    ], events)

    console.log(`  ✓ Inserted ${events.length} events`)

    // 3. Sessions (past 14 days)
    const sessions = []
    for (let i = 0; i < 120; i++) {
      const timeOffset = Math.floor(Math.random() * FourteenDaysMs)
      const start = new Date(now - timeOffset)
      const durationMs = randInt(45000, 1200000)
      const end = new Date(start.getTime() + durationMs)
      const userId = randItem(users)
      const loc = randItem(CITIES)
      const dev = randItem(BROWSERS)
      const converted = Math.random() < 0.28 ? 1 : 0

      sessions.push([
        tenantId,
        `sess_${userId}_${i}`,
        userId,
        fmtDate(start),
        fmtDate(end),
        durationMs,
        randInt(2, 12),
        randInt(3, 25),
        converted,
        randItem(['/', '/pricing', '/features']),
        converted ? '/checkout/success' : randItem(['/pricing', '/docs', '/dashboard']),
        loc.country,
        dev.device
      ])
    }

    await chInsertRows('sentinel.sessions', [
      'tenant_id', 'session_id', 'user_id', 'session_start', 'session_end',
      'duration_ms', 'page_depth', 'event_count', 'converted', 'entry_page',
      'exit_page', 'country', 'device_type'
    ], sessions)

    console.log(`  ✓ Inserted ${sessions.length} sessions`)

    // 4. Deployments (production, staging, development)
    const deployments = [
      // Production
      [crypto.randomUUID(), 'v3.3.1-hotfix', fmtDate(now - 30 * 60000), 'production', 'alex@kwudle.io', 'Hotfix: Redis cache TTL adjustment'],
      [crypto.randomUUID(), 'v3.3.0', fmtDate(now - 4 * 3600000), 'production', 'sarah@kwudle.io', 'Added Logs Explorer & AI Suggestions'],
      [crypto.randomUUID(), 'v3.2.2', fmtDate(now - 14 * 3600000), 'production', 'devops@kwudle.io', 'Ingest pipeline throughput optimization'],
      [crypto.randomUUID(), 'v3.2.0', fmtDate(now - 2 * 86400000), 'production', 'alex@kwudle.io', 'ClickHouse cluster 2-node replication setup'],
      [crypto.randomUUID(), 'v3.1.0', fmtDate(now - 5 * 86400000), 'production', 'sarah@kwudle.io', 'Added Fasthttp pipeline & Redis buffer'],
      [crypto.randomUUID(), 'v3.0.0', fmtDate(now - 10 * 86400000), 'production', 'devops@kwudle.io', 'Major v3 architecture upgrade'],

      // Staging
      [crypto.randomUUID(), 'v3.4.0-beta2', fmtDate(now - 45 * 60000), 'staging', 'sarah@kwudle.io', 'Staging test: OpenTelemetry gRPC exporter'],
      [crypto.randomUUID(), 'v3.4.0-beta1', fmtDate(now - 3 * 3600000), 'staging', 'alex@kwudle.io', 'Staging build: Next.js 14.2 bundle optimization'],
      [crypto.randomUUID(), 'v3.3.0-rc2', fmtDate(now - 12 * 3600000), 'staging', 'devops@kwudle.io', 'Staging RC: Fasthttp buffer tuning'],
      [crypto.randomUUID(), 'v3.3.0-rc1', fmtDate(now - 2 * 86400000), 'staging', 'sarah@kwudle.io', 'Initial release candidate testing'],

      // Development
      [crypto.randomUUID(), 'v3.4.0-dev.4', fmtDate(now - 20 * 60000), 'development', 'developer@kwudle.io', 'Dev sandbox build #42'],
      [crypto.randomUUID(), 'v3.4.0-dev.3', fmtDate(now - 2 * 3600000), 'development', 'developer@kwudle.io', 'Testing Fastify route compression'],
      [crypto.randomUUID(), 'v3.4.0-dev.2', fmtDate(now - 8 * 3600000), 'development', 'developer@kwudle.io', 'Refactored auth middleware'],
    ]



    await chInsertRows('sentinel.deployments', [
      'deployment_id', 'version', 'timestamp', 'environment', 'deployed_by', 'notes'
    ], deployments)

    console.log(`  ✓ Inserted ${deployments.length} deployments`)

    // 5. Logs (past 48h)
    const logTemplates = [
      { level: 'INFO', service: 'sentinel-ingest', message: 'Batch flushed 2,450 events to ClickHouse in 42ms', details: '{"batch_size":2450,"duration_ms":42,"partition":"202608"}' },
      { level: 'INFO', service: 'sentinel-api', message: 'GET /api/stats/overview 200 OK (cache HIT)', details: '{"route":"/api/stats/overview","status":200,"cache":"HIT"}' },
      { level: 'WARN', service: 'sentinel-worker', message: 'Alert rule check delayed by 1.2s due to Redis latency', details: '{"rule_id":"rule_error_rate","delay_ms":1200}' },
      { level: 'ERROR', service: 'sentinel-ingest', message: 'Dead letter queue write — ClickHouse connection timeout', details: '{"error":"dial tcp 127.0.0.1:9000: i/o timeout","dlq_path":"/data/dlq/dead_letter_queue.log"}' },
      { level: 'ERROR', service: 'sentinel-api', message: 'Failed to query ClickHouse quantileMerge', details: '{"query":"SELECT quantileMerge(0.99)(p99_state)...","error":"timeout"}' },
      { level: 'INFO', service: 'sentinel-dashboard', message: 'AI Suggestion job triggered manually by user', details: '{"user":"admin@kwudle.io","count":4}' },
      { level: 'DEBUG', service: 'sentinel-worker', message: 'Stitched 34 user sessions in 18ms', details: '{"sessions_stitched":34,"duration_ms":18}' },
      { level: 'WARN', service: 'sentinel-api', message: 'High CPU usage detected on query node', details: '{"cpu_percent":84.2,"memory_used_mb":412}' },
    ]

    const logs = []
    const FortyEightHoursMs = 48 * 60 * 60 * 1000
    for (let i = 0; i < 80; i++) {
      const timeOffset = Math.floor(Math.random() * FortyEightHoursMs)
      const logTime = fmtDate(now - timeOffset)
      const tmpl = randItem(logTemplates)

      logs.push([
        logTime,
        tmpl.level,
        tmpl.service,
        tmpl.message,
        tmpl.details,
        tenantId,
        `req_${1000 + i}`
      ])
    }

    await chInsertRows('sentinel.logs', [
      'timestamp', 'level', 'service', 'message', 'details', 'tenant_id', 'request_id'
    ], logs)

    console.log(`  ✓ Inserted ${logs.length} log rows`)

    // 6. AI Suggestions
    const suggestions = [
      [
        crypto.randomUUID(), tenantId, fmtDate(now - 3600000),
        'Performance', 'HIGH',
        'High P99 Latency on /checkout Page',
        'P99 latency on the checkout endpoint reached 1,850ms, causing an estimated 14% drop in conversion rate during peak hours.',
        'Optimize database queries on the payment gateway and add a Redis cache layer for pricing checks.',
        'Expected to decrease P99 latency below 300ms and boost checkout completion by +8.4%.',
        'data: p99_latency = 1850ms, checkout_dropoff = 14.2%, peak_hour_rps = 420',
        'active'
      ],
      [
        crypto.randomUUID(), tenantId, fmtDate(now - 7200000),
        'Conversion', 'HIGH',
        'High Drop-off at Step 2 of Onboarding Funnel',
        '62% of users drop off at the "Organisational Setup" step without completing project creation.',
        'Simplify the setup modal to require only 2 fields initially (Project Name and Environment) and defer team invitations to post-onboarding.',
        'Expected to improve onboarding completion from 38% to 58%.',
        'data: step1_users = 1240, step2_users = 471, completion_pct = 38.0%',
        'active'
      ],
      [
        crypto.randomUUID(), tenantId, fmtDate(now - 14400000),
        'Reliability', 'MEDIUM',
        'Intermittent HTTP 503 Errors on auth-service',
        'The auth-service is returning transient 503 errors under concurrent OTP verification bursts.',
        'Increase worker thread pool size from 10 to 35 and implement exponential backoff on client SDK retry policy.',
        'Will reduce HTTP 503 error rate from 2.4% to <0.1%.',
        'data: 503_error_count = 142, total_otp_requests = 5900, error_pct = 2.41%',
        'active'
      ],
      [
        crypto.randomUUID(), tenantId, fmtDate(now - 28800000),
        'Revenue', 'MEDIUM',
        'Unclaimed Free Tier Upgrades',
        'Over 80 users have hit 90% of their free event limits in the past 7 days but have not seen an upgrade prompt.',
        'Display an in-app banner offering a 14-day free Pro trial when usage exceeds 85%.',
        'Estimated to generate $4,200/mo in additional ARR.',
        'data: near_limit_users = 84, trial_conversion_benchmark = 22%',
        'active'
      ],
      [
        crypto.randomUUID(), tenantId, fmtDate(now - 43200000),
        'Engagement', 'LOW',
        'Low Usage of Heatmap & Session Replay Features',
        'Only 12% of weekly active users visit the Heatmap page despite viewing high volumes of user sessions.',
        'Add a direct "View Heatmap" action button inside the Session Detail drawer to increase feature discovery.',
        'Will boost feature engagement and improve user retention.',
        'data: heatmap_weekly_users = 14, total_weekly_active = 118',
        'active'
      ],
    ]

    await chInsertRows('sentinel.suggestions', [
      'id', 'tenant_id', 'generated_at', 'category', 'priority', 'title',
      'problem', 'suggestion', 'expected_impact', 'data_evidence', 'status'
    ], suggestions)

    console.log(`  ✓ Inserted ${suggestions.length} AI suggestions`)

    // 7. Alert Rules
    const alertRules = [
      [crypto.randomUUID(), tenantId, 'error_rate', 'gt', 5.0, 300, 'slack', 'https://hooks.slack.com/services/T00/B00/XXXXX', 1, fmtDate(now - 86400000), fmtDate(now - 3600000)],
      [crypto.randomUUID(), tenantId, 'p99_latency', 'gt', 800.0, 600, 'pagerduty', 'https://events.pagerduty.com/v2/enqueue', 1, fmtDate(now - 172800000), fmtDate(now - 14400000)],
      [crypto.randomUUID(), tenantId, 'event_count', 'gt', 50000.0, 3600, 'webhook', 'https://api.kwudle.io/webhooks/traffic-spike', 1, fmtDate(now - 259200000), null],
      [crypto.randomUUID(), tenantId, 'error_rate', 'gt', 15.0, 120, 'email', 'https://api.kwudle.io/alerts/email', 1, fmtDate(now - 345600000), fmtDate(now - 7200000)],
    ]

    await chInsertRows('sentinel.alert_rules', [
      'id', 'tenant_id', 'metric', 'operator', 'threshold', 'window_seconds',
      'notify_channel', 'notify_webhook', 'active', 'created_at', 'last_fired_at'
    ], alertRules)

    console.log(`  ✓ Inserted ${alertRules.length} alert rules`)

    // 8. Sampling Rules
    const samplingRules = [
      [crypto.randomUUID(), tenantId, 'Purchase', 1.0, 1, fmtDate(now - 86400000)],
      [crypto.randomUUID(), tenantId, 'CheckoutStart', 1.0, 1, fmtDate(now - 86400000)],
      [crypto.randomUUID(), tenantId, 'PageView', 0.25, 1, fmtDate(now - 86400000)],
      [crypto.randomUUID(), tenantId, 'ButtonClick', 0.50, 1, fmtDate(now - 86400000)],
      [crypto.randomUUID(), tenantId, '*', 0.50, 1, fmtDate(now - 86400000)],
    ]

    await chInsertRows('sentinel.sampling_rules', [
      'id', 'tenant_id', 'event_type', 'keep_rate', 'active', 'updated_at'
    ], samplingRules)

    console.log(`  ✓ Inserted ${samplingRules.length} sampling rules`)
  }


  console.log('\n🎉 Demo dataset seeded successfully!')
  console.log('👉 Visit http://localhost:3000 to explore Overview, Revenue, Funnel, Heatmap, AI Anomalies, Sessions, Deployments, Alerts, Sampling, Logs, and AI Suggestions!')
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err)
  process.exit(1)
})
