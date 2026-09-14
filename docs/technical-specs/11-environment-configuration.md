# 11 — Environment Configuration

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

Every variable is parsed and validated by `packages/config` at startup with a Zod schema. A missing or malformed value exits non-zero before the server binds. No module reads `process.env` directly.

Five environments: `dev` (local), `test` (CI), `sit`, `uat`, `production`.

## 11.1 Core

| Variable | Type | dev | test | sit / uat | production | Notes |
|---|---|---|---|---|---|---|
| `APP_ENV` | enum | `dev` | `test` | `sit` / `uat` | `production` | Drives route registration in 11.5 |
| `NODE_ENV` | enum | development | test | production | production | Library behaviour only |
| `PORT` | int | 3000 | 3000 | 3000 | 3000 | |
| `LOG_LEVEL` | enum | debug | error | info | info | pino |
| `WEB_ORIGIN` | url | `http://localhost:5173` | same | `https://sit.archiva.id` | `https://app.archiva.id` | Sole CORS origin |
| `TENANT_BASE_HOST` | host | `localhost` | `localhost` | `sit.archiva.id` / `uat.archiva.id` | `archiva.id` | Tenants resolve from `<subdomain>.<TENANT_BASE_HOST>`; the reserved `admin` label resolves to no tenant ([../api-specs/01-conventions.md 1.1](../api-specs/01-conventions.md)) |
| `APP_VERSION` | string | `dev` | `test` | git sha | git sha | Reported by `/health` |

## 11.2 Datastores

| Variable | Type | Secret | Notes |
|---|---|---|---|
| `DATABASE_URL` | url | yes | Read by `packages/db/src/client.ts`. Never inlined anywhere. |
| `DATABASE_POOL_MAX` | int | no | 10 for api, 4 for worker |
| `VALKEY_URL` | url | yes | BullMQ and the Top Tags cache |
| `OPENSEARCH_URL` | url | no | |
| `OPENSEARCH_USERNAME` | string | yes | |
| `OPENSEARCH_PASSWORD` | string | yes | |
| `OPENSEARCH_INDEX_PREFIX` | string | no | `archiva-dev`, `archiva-sit`, `archiva`. Prevents two environments sharing an index. |
| `S3_ENDPOINT` | url | no | MinIO locally, R2 or S3 in cloud |
| `S3_REGION` | string | no | |
| `S3_BUCKET` | string | no | |
| `S3_ACCESS_KEY_ID` | string | yes | |
| `S3_SECRET_ACCESS_KEY` | string | yes | |
| `S3_FORCE_PATH_STYLE` | bool | no | true for MinIO, false for R2 and S3 |

## 11.3 Sidecars and external services

| Variable | Type | Secret | Notes |
|---|---|---|---|
| `CLAMAV_HOST` | string | no | |
| `CLAMAV_PORT` | int | no | 3310 |
| `GOTENBERG_URL` | url | no | |
| `AI_PROVIDER` | enum | no | `anthropic`, `selfhosted`, `stub`. `stub` is rejected by the schema when `APP_ENV=production`. |
| `AI_API_KEY` | string | yes | Required unless the provider is `stub` |
| `AI_MODEL_CLASSIFY` | string | no | Exact pinned id. A change invalidates the AC-12.03 baseline. |
| `AI_MODEL_TAG` | string | no | Exact pinned id |
| `AI_DAILY_TOKEN_BUDGET` | int | no | Per tenant, per day |
| `OCR_PROVIDER` | enum | no | `hosted`, `tesseract`, `fixture` |
| `OCR_API_KEY` | string | yes | Required when `OCR_PROVIDER=hosted` |

## 11.4 Authentication

| Variable | Type | Secret | Notes |
|---|---|---|---|
| `AUTH_SECRET` | string | yes | At least 32 bytes. Rotating it ends every session. |
| `SESSION_ABSOLUTE_TTL_DAYS` | int | no | 30 |
| `SESSION_IDLE_TTL_HOURS` | int | no | 8, satisfies AC-40.04 |
| `COOKIE_DOMAIN` | | | **Removed.** The `__Host-` cookie prefix forbids a `Domain` attribute, so a browser rejects the session cookie outright if one is set. Each tenant subdomain therefore holds its own session, which matches the isolation posture and 01-overview.md 1.7 item 9. |

## 11.5 Operational endpoints

The section that matters most, because a mistake here is a production incident.

| Variable | dev | test | sit | uat | production | Notes |
|---|---|---|---|---|---|---|
| `ENABLE_RESET_API` | `true` | `true` | `true` | `true` | **absent** | Route not registered when false or absent |
| `RESET_API_TOKEN` | dev token | test token | unique | unique | **absent** | Rejected by the schema if set in production |
| `RESET_DEFAULT_SEED` | `dev` | `qa` | `qa` | `qa` | **absent** | Overridable per request |
| `HEALTH_TOKEN` | dev token | test token | unique | unique | unique | Guards `/health/ready` only |

Three enforcement layers, in order of reliability:

1. **Route registration.** `if (config.APP_ENV !== "production" && config.ENABLE_RESET_API)`. In production the branch never runs and the path is a plain 404.
2. **Schema refusal.** `packages/config` fails startup if `ENABLE_RESET_API` or `RESET_API_TOKEN` is set while `APP_ENV=production`. A misconfigured production deploy does not boot, rather than booting dangerously.
3. **CI assertion.** A test builds the app with a production configuration and asserts `POST /admin/reset-state` returns 404.

Layer 3 is what actually holds. The rule is only real if a test fails when someone breaks it.

`/health/live` is unauthenticated in every environment. `/health/ready` requires `HEALTH_TOKEN` in every environment including dev, so nobody develops against a laxer contract than production enforces.

## 11.6 Observability

| Variable | Type | Notes |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | url | Absent locally disables export |
| `OTEL_SERVICE_NAME` | string | `archiva-api` or `archiva-worker` |
| `OTEL_TRACES_SAMPLER_ARG` | float | 1.0 in dev and sit, 0.1 in production |

## 11.7 Worker

| Variable | Type | Notes |
|---|---|---|
| `WORKER_CONCURRENCY` | int | 4 default, see 08-nfr.md 8.3 |
| `WORKER_MAX_ATTEMPTS` | int | 3, the retry count behind AC-44.02 |
| `WORKER_BACKOFF_MS` | int | 5000, exponential |

## 11.8 Rules

1. `.env.example` lists every variable above with placeholder values and stays in sync. CI fails if a key exists in the schema but not in the example.
2. No default in code for any secret. A missing secret is a startup failure, never a silent fallback.
3. Config is read once at startup into a frozen object. Nothing re-reads the environment at request time, so behaviour cannot change under a running process.
4. Adding a variable means editing the Zod schema, `.env.example`, and this table in the same commit.
