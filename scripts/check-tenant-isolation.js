#!/usr/bin/env node
/**
 * check-tenant-isolation.js
 *
 * Walks all TypeScript API route files and flags any SQL string that
 * references a sentinel table WITHOUT a tenant_id filter in the same
 * function body.
 *
 * Exit code 0 = all clear
 * Exit code 1 = violations found
 *
 * Usage: node scripts/check-tenant-isolation.js
 * CI:    Used in .github/workflows/ci.yml after build
 */

const fs = require('fs')
const path = require('path')

const SEARCH_DIRS = [
  path.join(__dirname, '../services/api/src/routes'),
  path.join(__dirname, '../services/dashboard/src/app/api'),
]

const SENTINEL_TABLE_RE = /FROM\s+sentinel\./i
const TENANT_FILTER_RE = /tenant_id\s*[=<>!]/i

// Tables that are legitimately cross-tenant (admin or global reads)
const EXEMPT_TABLES = [
  'sentinel.sampling_rules',  // global defaults use tenant_id='00000000...'
  'sentinel.api_keys',        // admin route
  'sentinel.alert_rules',     // worker evaluates all rules
]

let violations = []

function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      checkFile(full)
    }
  }
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  // Simple heuristic: find SQL template literals / strings
  // that contain FROM sentinel. but NOT tenant_id filter nearby (±20 lines)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!SENTINEL_TABLE_RE.test(line)) continue

    // Check if this is an exempt table
    const isExempt = EXEMPT_TABLES.some(t => line.includes(t))
    if (isExempt) continue

    // Look at ±20 lines for tenant_id filter
    const start = Math.max(0, i - 20)
    const end = Math.min(lines.length, i + 20)
    const context = lines.slice(start, end).join('\n')

    if (!TENANT_FILTER_RE.test(context)) {
      violations.push({
        file: filePath,
        line: i + 1,
        content: line.trim(),
      })
    }
  }
}

for (const dir of SEARCH_DIRS) {
  walk(dir)
}

if (violations.length === 0) {
  console.log('✅ Tenant isolation check passed — all sentinel table queries have tenant_id filters.')
  process.exit(0)
} else {
  console.error(`❌ Tenant isolation violations found: ${violations.length}`)
  for (const v of violations) {
    console.error(`\n  File: ${v.file}:${v.line}`)
    console.error(`  SQL:  ${v.content}`)
    console.error(`  → Add WHERE tenant_id = {tenantId:UUID} or move to an exempt list if cross-tenant by design.`)
  }
  process.exit(1)
}
