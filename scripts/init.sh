#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Sentinel — one-shot bootstrap script
#  Run after `docker compose up` to initialise ClickHouse DDL
# ─────────────────────────────────────────────────────────────
set -euo pipefail

source .env 2>/dev/null || true

CH_HOST="${CLICKHOUSE_HOST:-localhost}"
CH_PORT="${CLICKHOUSE_PORT:-8123}"
CH_USER="${CLICKHOUSE_USER:-sentinel_user}"
CH_PASS="${CLICKHOUSE_PASSWORD:-}"

# ── Ensure runtime directories exist (required for bind-mounts) ──────────────
echo "📁 Creating runtime directories…"
mkdir -p data/dlq data/geoip
echo "✓ data/dlq and data/geoip ready"
echo ""

echo "⏳ Waiting for ClickHouse to be ready…"
for i in {1..30}; do
  if curl -sf "http://${CH_HOST}:${CH_PORT}/ping" > /dev/null 2>&1; then
    echo "✓ ClickHouse is up"
    break
  fi
  echo "  attempt $i/30 — sleeping 5s"
  sleep 5
done

echo "⏳ Running DDL migrations…"
curl -s \
  --user "${CH_USER}:${CH_PASS}" \
  --data-binary @scripts/clickhouse_ddl.sql \
  "http://${CH_HOST}:${CH_PORT}/"

echo "✓ DDL applied"
echo ""
echo "🎉 Sentinel is ready!"
echo "   Dashboard : http://localhost:3000"
echo "   Ingest API: http://localhost:8080"
echo "   Query API : http://localhost:3001"
echo "   ClickHouse: http://localhost:8123"
echo ""
echo "Provision your first tenant:"
echo "  curl -X POST http://localhost:3001/admin/tenants \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"name\":\"My Org\",\"tier\":\"pro\"}'"
