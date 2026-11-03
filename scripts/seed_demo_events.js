const crypto = require('crypto')
const net = require('net')

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

function fmtDate(d) {
  return new Date(d).toISOString().slice(0, 19).replace('T', ' ')
}

function resp(arr) {
  return '*' + arr.length + '\r\n' + arr.map(s => '$' + Buffer.byteLength(s) + '\r\n' + s + '\r\n').join('')
}

async function seedRedisKeys() {
  return new Promise((resolve) => {
    const client = net.connect(6379, 'localhost', () => {
      const redisPass = process.env.REDIS_PASSWORD || '1H0mkDrLaXbtdLtUg8qyFQ'
      client.write(resp(['AUTH', redisPass]))
      // Default production key from .env
      const vDefault = JSON.stringify({ tenant_id: '77f2888c-5c59-4b65-a6f2-d89812525694', rate_limit_tier: 'pro', revoked: false })
      const kDefault = 'apikey:6e3df3d7f06c3afe830c15c9945dbfd480e65e54dd74d734e4dd12611eeaf1d7'
      client.write(resp(['SET', kDefault, vDefault]))

      // Key 1
      const v1 = JSON.stringify({ tenant_id: '77f2888c-5c59-4b65-a6f2-d89812525694', rate_limit_tier: 'pro', revoked: false })
      const k1 = 'apikey:6c9c1553a363d2409d009f5678a09e11d5da974500c8072cf6fe858cd8adb676'
      client.write(resp(['SET', k1, v1]))

      // Key 2
      const v2 = JSON.stringify({ tenant_id: 'd965352b-88be-475b-9efa-2d614fb39f77', rate_limit_tier: 'pro', revoked: false })
      const k2 = 'apikey:eaccce42d77f70626eb53cf8510216056bacdbbed95c1f734600f4f6896fbb3f'
      client.write(resp(['SET', k2, v2]))
    })
    client.on('data', () => { client.end(); resolve() })
    client.on('error', () => resolve())
  })
}

// ── Domain Reference Data ─────────────────────────────────────────
const CITIES = [
  { city: 'Mumbai', country: 'IN', isp: 'Jio' },
  { city: 'Delhi', country: 'IN', isp: 'Airtel' },
  { city: 'Bengaluru', country: 'IN', isp: 'ACT Fibernet' },
  { city: 'New York', country: 'US', isp: 'Verizon' },
  { city: 'London', country: 'GB', isp: 'BT' },
]

const BROWSERS = [
  { browser: 'Chrome', version: '122.0', os: 'macOS', device: 'desktop' },
  { browser: 'Chrome', version: '122.0', os: 'Windows', device: 'desktop' },
  { browser: 'Safari', version: '17.3', os: 'iOS', device: 'mobile' },
  { browser: 'Chrome', version: '121.0', os: 'Android', device: 'mobile' },
]

const MENU_ITEMS = [
  { item_id: 'Cappuccino', category: 'Beverage', price: 220 },
  { item_id: 'Caramel Macchiato', category: 'Beverage', price: 290 },
  { item_id: 'Matcha Latte', category: 'Beverage', price: 310 },
  { item_id: 'Cold Brew', category: 'Beverage', price: 250 },
  { item_id: 'Avocado Toast', category: 'Food', price: 380 },
  { item_id: 'Classic Croissant', category: 'Bakery', price: 180 },
  { item_id: 'Blueberry Cheesecake', category: 'Dessert', price: 320 },
  { item_id: 'Truffle Pasta', category: 'Food', price: 540 },
  { item_id: 'Paneer Tikka Roll', category: 'Food', price: 280 },
  { item_id: 'Iced Americano', category: 'Beverage', price: 200 }
]

const BRANCHES = ['branch_koramangala', 'branch_indiranagar', 'branch_bandra', 'branch_connaught']

const REVIEWS = [
  { rating: 5, comment: 'Best Cold Brew and Avocado Toast in town! Lovely ambiance.' },
  { rating: 5, comment: 'Staff was super polite, table service was fast.' },
  { rating: 4, comment: 'Great coffee, took slightly long during peak lunch rush.' },
  { rating: 5, comment: 'Cappuccino was creamy and perfectly roasted.' },
  { rating: 4, comment: 'Desserts are top notch. Blueberry cheesecake is a must try.' },
  { rating: 2, comment: 'Waited 30 minutes for my order on Saturday evening.' },
  { rating: 1, comment: 'Order was mixed up and kitchen was slow.' }
]

const STOCK_ITEMS = [
  { item_id: 'Arabica Coffee Beans', category: 'Raw Materials', unit: 'kg', current_qty: 4.5, threshold: 10, status: 'StockLow' },
  { item_id: 'Oat Milk', category: 'Dairy', unit: 'litres', current_qty: 1.2, threshold: 8, status: 'StockLow' },
  { item_id: 'Almond Milk', category: 'Dairy', unit: 'litres', current_qty: 0, threshold: 5, status: 'StockOut' },
  { item_id: 'Organic Matcha Powder', category: 'Beverage', unit: 'grams', current_qty: 150, threshold: 500, status: 'StockLow' },
  { item_id: 'Whole Milk', category: 'Dairy', unit: 'litres', current_qty: 24, threshold: 15, status: 'StockReplenished' },
]

async function seed() {
  console.log('🌱 Seeding Demo Events for Kwudle & Business Platform…\n')
  await seedRedisKeys()

  const now = Date.now()
  const FourteenDaysMs = 14 * 24 * 60 * 60 * 1000

  for (const tenantId of TENANTS) {
    console.log(`📌 Seeding Tenant: ${tenantId}`)

    // 1. API Keys in ClickHouse
    await chInsertRows('sentinel.api_keys', ['key_hash', 'tenant_id', 'name', 'rate_limit_tier', 'created_at', 'revoked'], [
      ['6e3df3d7f06c3afe830c15c9945dbfd480e65e54dd74d734e4dd12611eeaf1d7', tenantId, 'Default Production Key', 'pro', '2026-01-01 00:00:00', 0],
      ['6c9c1553a363d2409d009f5678a09e11d5da974500c8072cf6fe858cd8adb676', tenantId, 'Frontend Web Key', 'pro', '2026-01-01 00:00:00', 0],
      ['eaccce42d77f70626eb53cf8510216056bacdbbed95c1f734600f4f6896fbb3f', tenantId, 'POS System Key', 'enterprise', '2026-01-01 00:00:00', 0],
    ]).catch(() => {})

    const events = []
    const users = Array.from({ length: 80 }, (_, i) => `cust_${1000 + i}`)

    // 2. Business Events (Cafe & Restaurant Orders over past 14 days)
    for (let i = 0; i < 600; i++) {
      const timeOffset = Math.floor(Math.pow(Math.random(), 1.1) * FourteenDaysMs)
      const eventTime = fmtDate(now - timeOffset)
      const user = randItem(users)
      const loc = randItem(CITIES)
      const dev = randItem(BROWSERS)
      const item = randItem(MENU_ITEMS)
      const branch = randItem(BRANCHES)
      const tableId = `T${randInt(1, 15)}`
      const orderId = `ord_${10000 + i}`
      const amount = item.price * randInt(1, 3)

      // Event 1: OrderPlaced
      events.push([
        crypto.randomUUID(), tenantId, 'OrderPlaced', eventTime, user,
        `sess_${user}`, `anon_${i}`, 'hash_ip_123', 'hash_email_456',
        loc.country, loc.city, loc.isp, dev.browser, dev.version, dev.os, dev.device,
        randFloat(20, 90), '', 200, `tr_${i}`, `sp_${i}`, '', 'pos-service', 1.0, 'production',
        JSON.stringify({
          order_id: orderId,
          table_id: tableId,
          item_id: item.item_id,
          category: item.category,
          amount: amount,
          quantity: Math.round(amount / item.price),
          location_id: branch
        }),
        eventTime, 'sentinel-ingest'
      ])

      // Event 2: PaymentProcessed (90% completed)
      if (Math.random() < 0.92) {
        const payTime = fmtDate(new Date(eventTime).getTime() + randInt(5, 35) * 60000)
        events.push([
          crypto.randomUUID(), tenantId, 'PaymentProcessed', payTime, user,
          `sess_${user}`, `anon_${i}`, 'hash_ip_123', 'hash_email_456',
          loc.country, loc.city, loc.isp, dev.browser, dev.version, dev.os, dev.device,
          randFloat(15, 60), '', 200, `tr_p_${i}`, `sp_p_${i}`, '', 'payment-gateway', 1.0, 'production',
          JSON.stringify({
            order_id: orderId,
            amount: amount,
            payment_method: randItem(['upi', 'card', 'upi', 'cash']),
            location_id: branch
          }),
          payTime, 'sentinel-ingest'
        ])
      }
    }

    // 3. Table Occupancy Events
    for (let t = 1; t <= 12; t++) {
      const tableId = `T${t}`
      const branch = randItem(BRANCHES)
      // Some freed, some currently occupied (last 2 hours)
      if (t <= 5) {
        // Currently occupied
        const occTime = fmtDate(now - randInt(10, 75) * 60000)
        events.push([
          crypto.randomUUID(), tenantId, 'TableOccupied', occTime, `cust_${t}`,
          `sess_table_${t}`, `anon_t_${t}`, 'hash_ip', 'hash_email',
          'IN', 'Bengaluru', 'ACT', 'Safari', '17.2', 'iOS', 'mobile',
          25, '', 200, `tr_t_${t}`, `sp_t_${t}`, '', 'table-service', 1.0, 'production',
          JSON.stringify({ table_id: tableId, party_size: randInt(2, 6), location_id: branch }),
          occTime, 'sentinel-ingest'
        ])
      } else {
        // Occupied and then Freed
        const occTime = fmtDate(now - randInt(120, 600) * 60000)
        const dur = randInt(25, 70)
        const freedTime = fmtDate(new Date(occTime).getTime() + dur * 60000)
        events.push([
          crypto.randomUUID(), tenantId, 'TableOccupied', occTime, `cust_${t}`,
          `sess_table_${t}`, `anon_t_${t}`, 'hash_ip', 'hash_email',
          'IN', 'Bengaluru', 'ACT', 'Safari', '17.2', 'iOS', 'mobile',
          25, '', 200, `tr_t_${t}`, `sp_t_${t}`, '', 'table-service', 1.0, 'production',
          JSON.stringify({ table_id: tableId, party_size: randInt(2, 6), location_id: branch }),
          occTime, 'sentinel-ingest'
        ])
        events.push([
          crypto.randomUUID(), tenantId, 'TableFreed', freedTime, `cust_${t}`,
          `sess_table_${t}`, `anon_t_${t}`, 'hash_ip', 'hash_email',
          'IN', 'Bengaluru', 'ACT', 'Safari', '17.2', 'iOS', 'mobile',
          20, '', 200, `tr_tf_${t}`, `sp_tf_${t}`, '', 'table-service', 1.0, 'production',
          JSON.stringify({ table_id: tableId, duration_minutes: dur, location_id: branch }),
          freedTime, 'sentinel-ingest'
        ])
      }
    }

    // 4. Live Stock Alerts
    for (const stock of STOCK_ITEMS) {
      const stockTime = fmtDate(now - randInt(5, 180) * 60000)
      events.push([
        crypto.randomUUID(), tenantId, stock.status, stockTime, 'system_inventory',
        'sess_inv', 'anon_inv', 'hash_ip', 'hash_email',
        'IN', 'Mumbai', 'Jio', 'Chrome', '122.0', 'Linux', 'server',
        10, '', 200, `tr_stk_${stock.item_id}`, `sp_stk`, '', 'inventory-service', 1.0, 'production',
        JSON.stringify({
          item_id: stock.item_id,
          category: stock.category,
          unit: stock.unit,
          current_qty: stock.current_qty,
          threshold: stock.threshold,
          location_id: 'branch_koramangala'
        }),
        stockTime, 'sentinel-ingest'
      ])
    }

    // 5. Customer Reviews
    for (let r = 0; r < 25; r++) {
      const rev = randItem(REVIEWS)
      const revTime = fmtDate(now - randInt(1, 14) * 86400000 + randInt(0, 86400000))
      events.push([
        crypto.randomUUID(), tenantId, 'ReviewSubmitted', revTime, randItem(users),
        'sess_rev', 'anon_rev', 'hash_ip', 'hash_email',
        'IN', 'Delhi', 'Airtel', 'Chrome', '121.0', 'Android', 'mobile',
        30, '', 200, `tr_rev_${r}`, `sp_rev`, '', 'review-service', 1.0, 'production',
        JSON.stringify({
          order_id: `ord_${10000 + r}`,
          rating: rev.rating,
          comment: rev.comment,
          location_id: randItem(BRANCHES)
        }),
        revTime, 'sentinel-ingest'
      ])
    }

    // 6. SaaS / Startup events (Signups, Subscriptions, MRR)
    for (let s = 0; s < 80; s++) {
      const sTime = fmtDate(now - randInt(1, 14) * 86400000)
      const u = `saas_user_${s}`
      events.push([
        crypto.randomUUID(), tenantId, 'Signup', sTime, u,
        `sess_${u}`, `anon_s_${s}`, 'hash_ip', 'hash_email',
        'US', 'San Francisco', 'Comcast', 'Chrome', '122.0', 'macOS', 'desktop',
        40, '', 200, `tr_s_${s}`, `sp_s`, '', 'auth-service', 1.0, 'production',
        JSON.stringify({ plan: randItem(['free', 'free', 'pro']), source: randItem(['google', 'twitter', 'github']) }),
        sTime, 'sentinel-ingest'
      ])
      if (Math.random() < 0.45) {
        events.push([
          crypto.randomUUID(), tenantId, 'TrialStarted', sTime, u,
          `sess_${u}`, `anon_s_${s}`, 'hash_ip', 'hash_email',
          'US', 'San Francisco', 'Comcast', 'Chrome', '122.0', 'macOS', 'desktop',
          35, '', 200, `tr_tr_${s}`, `sp_tr`, '', 'auth-service', 1.0, 'production',
          JSON.stringify({ trial_days: 14, plan: 'pro' }),
          sTime, 'sentinel-ingest'
        ])
      }
      if (Math.random() < 0.25) {
        const mrr = randItem([49, 99, 299])
        events.push([
          crypto.randomUUID(), tenantId, 'Subscribed', sTime, u,
          `sess_${u}`, `anon_s_${s}`, 'hash_ip', 'hash_email',
          'US', 'San Francisco', 'Comcast', 'Chrome', '122.0', 'macOS', 'desktop',
          50, '', 200, `tr_sub_${s}`, `sp_sub`, '', 'billing-service', 1.0, 'production',
          JSON.stringify({ plan: 'pro', mrr_delta: mrr }),
          sTime, 'sentinel-ingest'
        ])
        events.push([
          crypto.randomUUID(), tenantId, 'InvoicePaid', sTime, u,
          `sess_${u}`, `anon_s_${s}`, 'hash_ip', 'hash_email',
          'US', 'San Francisco', 'Comcast', 'Chrome', '122.0', 'macOS', 'desktop',
          50, '', 200, `tr_inv_${s}`, `sp_inv`, '', 'billing-service', 1.0, 'production',
          JSON.stringify({ plan: 'pro', mrr_delta: mrr }),
          sTime, 'sentinel-ingest'
        ])
      }
    }

    // 7. General Web telemetry events (PageView, ButtonClick, etc.)
    for (let w = 0; w < 400; w++) {
      const wTime = fmtDate(now - Math.floor(Math.random() * FourteenDaysMs))
      const loc = randItem(CITIES)
      const dev = randItem(BROWSERS)
      const isErr = Math.random() < 0.04
      const status = isErr ? 500 : 200
      events.push([
        crypto.randomUUID(), tenantId, 'PageView', wTime, randItem(users),
        `sess_w_${w}`, `anon_w_${w}`, 'hash_ip', 'hash_email',
        loc.country, loc.city, loc.isp, dev.browser, dev.version, dev.os, dev.device,
        isErr ? randFloat(500, 1800) : randFloat(18, 120), isErr ? 'ERR_INTERNAL' : '', status,
        `tr_w_${w}`, `sp_w_${w}`, '', 'web-frontend', 1.0, 'production',
        JSON.stringify({ path: randItem(['/', '/menu', '/cart', '/checkout', '/orders']), referrer: 'direct' }),
        wTime, 'sentinel-ingest'
      ])
    }

    // Bulk Insert all events
    await chInsertRows('sentinel.events', [
      'event_id', 'tenant_id', 'event_type', 'timestamp', 'user_id', 'session_id',
      'anonymous_id', 'ip_address_hash', 'email_hash', 'country', 'city', 'isp',
      'browser', 'browser_version', 'os', 'device_type', 'latency_ms', 'error_code',
      'status_code', 'trace_id', 'span_id', 'parent_span_id', 'service_name',
      'sampling_rate', 'deployment_env', 'properties', 'received_at', 'ingested_by'
    ], events)

    console.log(`  ✓ Inserted ${events.length} total events`)

    // 8. Insert Deployments
    const deployments = [
      [crypto.randomUUID(), 'v3.3.1-hotfix', fmtDate(now - 30 * 60000), 'production', 'alex@kwudle.io', 'Hotfix: Fastify CORS update'],
      [crypto.randomUUID(), 'v3.3.0', fmtDate(now - 4 * 3600000), 'production', 'sarah@kwudle.io', 'Added Business Intelligence & Setup Wizard'],
      [crypto.randomUUID(), 'v3.2.0', fmtDate(now - 2 * 86400000), 'production', 'devops@kwudle.io', 'Real-time Ingestion Engine scaling'],
    ]
    await chInsertRows('sentinel.deployments', [
      'deployment_id', 'version', 'timestamp', 'environment', 'deployed_by', 'notes'
    ], deployments).catch(() => {})

    // 9. Insert Sessions
    const sessions = []
    for (let i = 0; i < 80; i++) {
      const timeOffset = Math.floor(Math.random() * FourteenDaysMs)
      const start = new Date(now - timeOffset)
      const dur = randInt(45000, 900000)
      const end = new Date(start.getTime() + dur)
      const u = randItem(users)
      const loc = randItem(CITIES)
      const dev = randItem(BROWSERS)
      sessions.push([
        tenantId, `sess_${u}_${i}`, u, fmtDate(start), fmtDate(end),
        dur, randInt(2, 10), randInt(3, 20), Math.random() < 0.35 ? 1 : 0,
        '/menu', '/checkout/success', loc.country, dev.device
      ])
    }
    await chInsertRows('sentinel.sessions', [
      'tenant_id', 'session_id', 'user_id', 'session_start', 'session_end',
      'duration_ms', 'page_depth', 'event_count', 'converted', 'entry_page',
      'exit_page', 'country', 'device_type'
    ], sessions).catch(() => {})

    // 10. Suggestions
    const suggestions = [
      [
        crypto.randomUUID(), tenantId, fmtDate(now - 3600000),
        'Operations', 'HIGH',
        'Peak Rush Delay at Branch Koramangala',
        'Order wait times on Saturday 19:00–21:00 exceed 25 minutes due to kitchen beverage queue.',
        'Add an additional barista during weekend peak hours to cut average drink prep time by 40%.',
        'Expected to improve weekend table turnover by +18% and reduce negative reviews.',
        'data: avg_wait_sat = 26.4min, sat_orders = 142',
        'active'
      ],
      [
        crypto.randomUUID(), tenantId, fmtDate(now - 7200000),
        'Revenue', 'MEDIUM',
        'High Demand for Cold Brew & Bakery Pairings',
        '72% of customers ordering Cold Brew also browse Bakery items, but only 28% add to cart.',
        'Bundle Cold Brew + Croissant at a 10% combo discount to lift Average Order Value.',
        'Projected to generate additional ₹38,000/mo across all 4 locations.',
        'data: cold_brew_views = 380, combo_conversions = 28.1%',
        'active'
      ]
    ]
    await chInsertRows('sentinel.suggestions', [
      'id', 'tenant_id', 'generated_at', 'category', 'priority', 'title',
      'problem', 'suggestion', 'expected_impact', 'data_evidence', 'status'
    ], suggestions).catch(() => {})
  }

  console.log('\n🎉 Demo events and business data seeded successfully!')
  console.log('👉 Dashboard: http://localhost:3000/dashboard')
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err)
  process.exit(1)
})
