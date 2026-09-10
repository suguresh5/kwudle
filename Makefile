.PHONY: up down build logs shell-ch shell-redis init test lint env dlq-dir test-go test-node seed

## Start all services in background
up:
	docker compose up -d

## Stop all services
down:
	docker compose down

## Build all images (no cache)
build:
	docker compose build --no-cache

## Apply ClickHouse DDL (run once after first `make up`)
init:
	./scripts/init.sh

## Tail logs for all services
logs:
	docker compose logs -f --tail=100

## Tail a single service: make logs-ingest
logs-%:
	docker compose logs -f --tail=100 sentinel-$*

## Open ClickHouse shell
shell-ch:
	docker exec -it clickhouse-01 clickhouse-client \
		--user ${CLICKHOUSE_USER:-sentinel_user} \
		--password ${CLICKHOUSE_PASSWORD:-}

## Open Redis CLI
shell-redis:
	docker exec -it sentinel-redis redis-cli -a ${REDIS_PASSWORD:-}

## Smoke-test: create tenant + send one event
test:
	@echo "Creating test tenant…"
	@RESULT=$$(curl -sf -X POST http://localhost:3001/admin/tenants \
		-H 'Content-Type: application/json' \
		-d '{"name":"test-org","tier":"pro"}'); \
	echo "$$RESULT"; \
	KEY=$$(echo $$RESULT | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4); \
	echo "Sending test event with key $$KEY…"; \
	curl -sf -X POST http://localhost:8080/v1/events \
		-H "Authorization: Bearer $$KEY" \
		-H 'Content-Type: application/json' \
		-d '{"event_type":"PageView","user_id":"u_test","ip":"1.2.3.4","latency_ms":42,"deployment_env":"production"}'; \
	echo ""; \
	echo "Done — check http://localhost:3000"

## Generate a secure .env from .env.example (requires openssl)
env:
	@cp .env.example .env
	@sed -i "s|change_me_strong_password|$$(openssl rand -base64 24)|g" .env
	@sed -i "s|change_me_redis_password|$$(openssl rand -base64 24)|g" .env
	@sed -i "s|change_me_generate_with_openssl_rand_base64_32|$$(openssl rand -base64 32)|g" .env
	@sed -i "s|change_me_admin_jwt_secret|$$(openssl rand -base64 32)|g" .env
	@echo "✓ .env generated with random secrets — edit GEOIP_DB_PATH and webhook URLs"

## Create required runtime directories for bind-mounts (run before `make up`)
dlq-dir:
	mkdir -p data/dlq data/geoip
	@echo "✓ data/dlq and data/geoip created"

## Run Go unit tests for ingest + worker services
test-go:
	@echo "── ingest ──────────────────────"
	cd services/ingest && go vet ./... && go test -v -race ./...
	@echo "── worker ──────────────────────"
	cd services/worker && go vet ./... && go test -v -race ./...

## Run Node.js tests for api + dashboard services
test-node:
	@echo "── api ─────────────────────────"
	cd services/api && npm test --if-present
	@echo "── dashboard ───────────────────"
	cd services/dashboard && npm test --if-present

## Seed demo data into ClickHouse (run after `make init`)
seed:
	node scripts/seed_demo_data.js
