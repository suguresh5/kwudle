const path = require('path')
const bcrypt = require(path.join(__dirname, '../services/dashboard/node_modules/bcryptjs'))

async function seed() {
  const hash = bcrypt.hashSync('password123', 10)
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '')
  const query = `
    INSERT INTO sentinel.dashboard_users
    (email, name, password_hash, business_setup_complete, business_type, created_at, updated_at)
    VALUES ('admin@kwudle.io', 'Admin', '${hash}', 1, 'startup', '${now}', '${now}')
  `

  const chHost = process.env.CLICKHOUSE_HOST ? `http://${process.env.CLICKHOUSE_HOST}:8123` : 'http://localhost:8123'
  const chUser = process.env.CLICKHOUSE_USER || 'sentinel_user'
  const chPass = process.env.CLICKHOUSE_PASSWORD || 'change_me_strong_password'

  const res = await fetch(`${chHost}/?user=${chUser}&password=${chPass}`, {
    method: 'POST',
    body: query,
  })

  if (!res.ok) {
    console.error('Failed to seed admin user:', await res.text())
    process.exit(1)
  }

  console.log('✅ Successfully seeded admin@kwudle.io / password123')
}

seed()
