# Archiva Deployment Plan

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Tech Lead  
**Status:** Approved  
**Phase:** Release 1  

The operational runbook. Every command here is copy-paste runnable once the variables in section 5.1 are set. Where a command destroys data it carries a warning naming what is lost.

This document owns deployment, release and operations. It does not own engineering work; that is [TASK_BREAKDOWN.md](TASK_BREAKDOWN.md).

## Table of contents

1. [Environments](#1-environments)
2. [Infrastructure overview](#2-infrastructure-overview)
3. [Artifacts and registry](#3-artifacts-and-registry)
4. [Configuration and secrets](#4-configuration-and-secrets)
5. [Initial deployment](#5-initial-deployment)
6. [Updating to a new release](#6-updating-to-a-new-release)
7. [Reverse proxy and TLS](#7-reverse-proxy-and-tls)
8. [Rollback](#8-rollback)
9. [Database state reset](#9-database-state-reset)
10. [Inspecting and debugging the database](#10-inspecting-and-debugging-the-database)
11. [Known gaps](#11-known-gaps)

## 1. Environments

| Env | Host | Purpose | Who deploys | Reset allowed |
|---|---|---|---|---|
| `dev` | Developer laptop | Local development | Any engineer | Yes, freely |
| `test` | CI runner | Automated suites, ephemeral | CI only | Yes, per run |
| `sit` | `sit.archiva.id` | System integration testing | Tech Lead | Yes |
| `uat` | `uat.archiva.id` | Customer acceptance | Tech Lead | Yes, with QA agreement |
| `production` | `app.archiva.id` | Live | Tech Lead only | **Forbidden. The route is not mounted.** |

Tenant subdomains resolve under the environment host: tenant `contohbaru` in SIT is `contohbaru.sit.archiva.id`. Super Admin operations use the reserved `admin` subdomain ([api-specs/01-conventions.md 1.1](api-specs/01-conventions.md)). Both need a wildcard DNS record and a wildcard certificate.

## 2. Infrastructure overview

One VPS per environment, Docker Compose, all containers on one host and one private network. There is no separate database VM, so every command in this runbook runs on the single host and no step is host-ambiguous.

```
Internet
   |
   v
[caddy]  :80 :443          TLS, static SPA, reverse proxy
   |
   +--> [api]     :3000    the only public application entry point
   |       |
   |       +--> postgres, opensearch, valkey, minio, gotenberg
   |
   [worker]                BullMQ consumer, no public surface
           |
           +--> postgres, opensearch, valkey, minio, clamav, AI provider
```

| Component | Image | Host ports | Purpose |
|---|---|---|---|
| `caddy` | `caddy:2.10-alpine` | 80, 443 | TLS, SPA, reverse proxy |
| `api` | `ghcr.io/pt-perkasa-pilar-utama/archiva-api` | none | HTTP API |
| `worker` | `ghcr.io/pt-perkasa-pilar-utama/archiva-worker` | none | Pipeline consumer |
| `migrate` | same image as `api` | none | One-shot, exits before `api` starts |
| `postgres` | `postgres:17.2` | none | Primary database |
| `opensearch` | `opensearchproject/opensearch:2.19.0` | none | Page-level search index |
| `valkey` | `valkey/valkey:8.1` | none | BullMQ backing and cache |
| `minio` | `minio/minio` | none | S3-compatible blob store |
| `clamav` | `clamav/clamav:1.4` | none | Malware scanning |
| `gotenberg` | `gotenberg/gotenberg:8.15.0` | none | Office to PDF conversion |

**Network boundary.** In production only Caddy binds host ports; every datastore is reachable on the compose network alone. Confirm after any compose change:

```bash
# Expect exactly 3 published ports, all Caddy (80, 443, 443/udp).
docker compose -f compose.yaml -f compose.prod.yaml config | grep -c 'published:'
```

## 3. Artifacts and registry

Images are built by CI, never on the host. `.github/workflows/deploy.yml` runs the same quality gate a PR runs, then pushes both images tagged with the **exact commit SHA**. There is no `:latest`, so a deploy names one immutable artifact and a rollback names the previous one ([technical-specs/04-tech-stack.md 4.10](technical-specs/04-tech-stack.md)).

```
ghcr.io/pt-perkasa-pilar-utama/archiva-api:<sha>
ghcr.io/pt-perkasa-pilar-utama/archiva-worker:<sha>
```

The built SPA is a CI artifact (`web-dist-<sha>`), not an image. Caddy serves it from `./web-dist` on the host.

Authenticate the host to GHCR once:

```bash
# A classic PAT with read:packages only.
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-username> --password-stdin
```

## 4. Configuration and secrets

Every variable is parsed once at startup by `packages/config` with a Zod schema. A missing or malformed value exits non-zero **before the server binds**, so a misconfigured deploy fails fast rather than serving half-configured. The authoritative per-environment table is [technical-specs/11-environment-configuration.md](technical-specs/11-environment-configuration.md).

```bash
cp .env.example .env
chmod 600 .env
```

`.env` is gitignored and must never be committed. `docker compose up` fails without it, because `api` and `worker` declare `env_file: [.env]`.

Generate the three secrets that have no external source:

```bash
openssl rand -hex 32   # AUTH_SECRET, min 32 bytes. Rotating it ends every session.
openssl rand -hex 24   # HEALTH_TOKEN
openssl rand -hex 24   # RESET_API_TOKEN, non-production only
```

**Production must not set `ENABLE_RESET_API` or `RESET_API_TOKEN` at all.** The config schema refuses to boot if either is present while `APP_ENV=production`.

Two deployment variables sit alongside them:

```bash
ARCHIVA_VERSION=<git sha>      # the exact image tag to run
ARCHIVA_DOMAIN=app.archiva.id  # the host Caddy issues a certificate for
```

## 5. Initial deployment

### 5.1 Set the target

```bash
# Set once, then paste the rest of this section verbatim.
export ARCHIVA_ENV=sit
export ARCHIVA_DOMAIN=sit.archiva.id
export ARCHIVA_VERSION=<git sha from the CI run summary>
export COMPOSE="docker compose -f compose.yaml -f compose.prod.yaml"
```

### 5.2 Host prerequisites

```bash
# Docker Engine with the compose plugin.
docker --version && docker compose version

# DNS: a wildcard record so tenant subdomains resolve.
#   *.sit.archiva.id -> <host ip>
#   sit.archiva.id   -> <host ip>
dig +short "$ARCHIVA_DOMAIN"

# 80 and 443 must be free and reachable, or ACME issuance fails.
sudo ss -lntp | grep -E ':(80|443) ' || echo "80 and 443 free"
```

### 5.3 Fetch the deployment files

The host needs four files, not the source tree.

```bash
mkdir -p /opt/archiva && cd /opt/archiva
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/PT-Perkasa-Pilar-Utama/fileplume.git .
git sparse-checkout set compose.yaml compose.prod.yaml Caddyfile .env.example
```

### 5.4 Configure

```bash
cp .env.example .env && chmod 600 .env
$EDITOR .env     # per section 4 and technical-specs/11-environment-configuration.md
```

### 5.5 Place the built SPA

```bash
# Download the web-dist artifact for this SHA from the CI run, then:
mkdir -p web-dist && unzip -o "web-dist-$ARCHIVA_VERSION.zip" -d web-dist
ls web-dist/index.html   # must exist, or Caddy serves nothing
```

### 5.6 Start the datastores

```bash
$COMPOSE pull
$COMPOSE up -d postgres opensearch valkey minio clamav gotenberg

# Wait for Postgres to accept connections before migrating.
until $COMPOSE exec -T postgres pg_isready -U archiva; do sleep 2; done
```

### 5.7 Migrate

The runner resolves its own migrations folder relative to its module and reads `DATABASE_URL` from the environment. Never pass a path and never pipe a `.sql` file: that applies schema outside the ledger, and the next migration then runs against a database the ledger does not describe ([technical-specs/06-data-model.md 6.11](technical-specs/06-data-model.md)).

```bash
# One command. It finds its own files and its own connection string.
$COMPOSE run --rm migrate

# Verify it exited zero before starting the app.
$COMPOSE ps -a migrate
```

### 5.8 Seed

```bash
# SIT and UAT use the QA seed, which carries every fixture the criteria name.
$COMPOSE run --rm api bun run db:seed:qa
```

Production has no seed script. Its first tenant is created through `POST /tenants` on the `admin` subdomain ([api-specs/03-tenants.md 3.1](api-specs/03-tenants.md)).

### 5.9 Start the application and proxy

```bash
$COMPOSE up -d api worker caddy
$COMPOSE ps
```

### 5.10 Verify

```bash
# 1. Liveness through the proxy, over TLS.
curl -fsS "https://$ARCHIVA_DOMAIN/health/live" | jq .

# 2. Readiness with the token. Every dependency reports its own status.
curl -fsS -H "Authorization: Bearer $HEALTH_TOKEN" \
  "https://$ARCHIVA_DOMAIN/health/ready" | jq '.status, .checks'

# 3. Readiness must NOT be publicly reachable. Expect 401, never 200.
curl -s -o /dev/null -w '%{http_code}\n' "https://$ARCHIVA_DOMAIN/health/ready"

# 4. Production only: the reset route must not exist. Expect 404.
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  "https://$ARCHIVA_DOMAIN/admin/reset-state"
```

A `degraded` overall status is acceptable and returns 200: `gotenberg` and `aiProvider` can degrade without taking the system down. `postgres` cannot degrade; if it is not `ok`, the deploy has failed.

## 6. Updating to a new release

### 6.1 Standard update, no schema change

```bash
export ARCHIVA_VERSION=<new git sha>
$COMPOSE pull api worker
$COMPOSE up -d api worker
$COMPOSE ps
curl -fsS "https://$ARCHIVA_DOMAIN/health/live" | jq .version
```

Replace `web-dist` in the same step when the SPA changed (section 5.5). Caddy serves from the volume, so no restart is needed.

### 6.2 Update with schema changes

Migrations run against the **new** image before the app starts, so the schema is never behind the code that expects it.

```bash
export ARCHIVA_VERSION=<new git sha>

# 1. Back up first. This is the only copy if a migration is destructive.
$COMPOSE exec -T postgres pg_dump -U archiva -Fc archiva > "backup-$(date +%F-%H%M).dump"

# 2. Pull the new images.
$COMPOSE pull

# 3. Stop the writers so no request races the migration.
$COMPOSE stop api worker

# 4. Migrate using the NEW image.
$COMPOSE run --rm migrate

# 5. Start the new app.
$COMPOSE up -d api worker
```

### 6.3 Pinning and verifying the running version

```bash
# What is actually running, by digest.
$COMPOSE images api worker

# What the app reports.
curl -fsS "https://$ARCHIVA_DOMAIN/health/live" | jq -r .version
```

### 6.4 Troubleshooting a failed update

| Symptom | Cause | Action |
|---|---|---|
| `api` restarts in a loop, exits immediately | Config validation failed | `$COMPOSE logs api \| head -20`. The `config:` lines name the offending variable. |
| Container did not change after `up -d` | Same tag pulled | Confirm `ARCHIVA_VERSION` changed; `$COMPOSE up -d --force-recreate api` |
| `denied` on pull | GHCR auth expired | Re-run the `docker login` in section 3 |
| Migration exits non-zero | Schema conflict or unreachable DB | `$COMPOSE logs migrate`. Do not start `api`. Restore from the backup in 6.2 step 1. |
| 502 from Caddy | `api` not healthy yet | `$COMPOSE logs api`, then re-run the 5.10 checks |
| SPA loads but every call 401s | `WEB_ORIGIN` mismatch, cookie rejected | Confirm `WEB_ORIGIN` equals the browser origin exactly, scheme included |

## 7. Reverse proxy and TLS

Caddy issues and renews certificates automatically over ACME. There is no manual certificate step, no DH parameter generation, and no HTTP-to-HTTPS config swap: Caddy redirects HTTP to HTTPS by default.

Tenants are subdomains, so the certificate must be a wildcard. Wildcard issuance requires the DNS-01 challenge, which requires a DNS provider credential and a Caddy build carrying the matching DNS plugin. The stock `caddy:2.10-alpine` image has none. See Known gaps.

Until the DNS provider is chosen, SIT can run on the single host name over HTTP-01 without tenant subdomains, which exercises everything except subdomain tenant resolution.

```bash
# Certificate issuer and expiry.
echo | openssl s_client -servername "$ARCHIVA_DOMAIN" -connect "$ARCHIVA_DOMAIN:443" 2>/dev/null \
  | openssl x509 -noout -issuer -dates

# The security headers from technical-specs/07-security.md 7.4.
curl -sI "https://$ARCHIVA_DOMAIN/" \
  | grep -iE 'strict-transport|x-content-type|x-frame|referrer-policy|content-security'
```

## 8. Rollback

An image rollback is a tag change. It is fast and safe **when no migration ran between the two versions**.

```bash
# 1. Identify the previous good SHA.
$COMPOSE images api

# 2. Point at it and restart.
export ARCHIVA_VERSION=<previous git sha>
$COMPOSE up -d api worker

# 3. Verify.
curl -fsS "https://$ARCHIVA_DOMAIN/health/live" | jq -r .version
```

Restore the matching `web-dist` artifact for that SHA in the same step, or the SPA and the API will disagree about the contract.

### 8.1 The database does not roll back

**There are no down-migrations.** Rolling the image back does not roll the schema back.

| Migration between the versions | Safe to roll back | Action |
|---|---|---|
| None | Yes | Section 8, nothing more |
| Additive only, new nullable column or new table | Usually | Old code ignores what it does not know about. Verify on SIT first. |
| Destructive, dropped or renamed column or narrowed type | **No** | Restore the backup from 6.2 step 1. Expect loss between backup and now. |

```bash
# Restoring a dump. WARNING: replaces the entire database. Every row written
# since the dump is lost.
$COMPOSE stop api worker
cat backup-2026-09-10-1430.dump | $COMPOSE exec -T postgres \
  pg_restore -U archiva -d archiva --clean --if-exists
$COMPOSE up -d api worker
```

Blob storage and the search index are not in a database dump. After a restore, reindex and expect blobs written after the dump to be orphaned.

**Escalation.** A destructive rollback in production is a Tech Lead decision, not an operator one. Take a fresh dump before touching anything, then escalate.

## 9. Database state reset

The procedure behind the QA request "reset the data to the initial state".

### 9.1 Environment gating

| Env | Reset allowed | Seed | Mechanism |
|---|---|---|---|
| `dev` | Yes | `dev` | Reset API or manual |
| `test` | Yes, per run | `qa` | CI, ephemeral container |
| `sit` | Yes | `qa` | Reset API |
| `uat` | Yes, with QA agreement | `qa` | Reset API |
| `production` | **Forbidden** | none | **The route is not mounted. It does not exist.** |

Production is not protected by an authorization check that could be misconfigured. The registration branch never runs, so the path returns the same 404 as any unknown URL, and a CI test asserts it ([technical-specs/07-security.md 7.6.2](technical-specs/07-security.md)).

### 9.2 What "initial state" means

Schema at the latest migration plus the environment's seed dataset, and nothing else:

- Every table dropped and recreated from the migration ledger.
- The seed applied: one tenant, four users covering every role, the reserved `Uncategorized` category plus four realistic ones, and the fixture documents the criteria name.
- The blob bucket prefix purged.
- The OpenSearch index deleted and recreated.
- The BullMQ queue flushed.

Anything a tester uploaded is gone. That is the point.

### 9.3 Preferred path, the reset API

Use this while the app is running. It performs the sequence in the right order and audits the invocation before it starts.

```bash
# The confirm value is environment-bound, so a request captured from SIT
# cannot be replayed against UAT.
curl -fsS -X POST "https://$ARCHIVA_DOMAIN/admin/reset-state" \
  -H "Authorization: Bearer $RESET_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"seed\":\"qa\",\"confirm\":\"reset-$ARCHIVA_ENV\"}" | jq .

# Returns 202 with a jobId. Poll until succeeded.
curl -fsS -H "Authorization: Bearer $RESET_API_TOKEN" \
  "https://$ARCHIVA_DOMAIN/admin/reset-state/<jobId>" | jq '.status, .stage'
```

It runs as a job because dropping, re-migrating and reseeding exceeds any sane request timeout. Stages in order: `drop`, `migrate`, `seed`, `purge_blobs`, `recreate_index`, `flush_queue`.

A failed reset leaves the environment at whatever stage it reached. It is not rolled back, because there is nothing to roll back to. Rerun it, or fall back to 9.4.

### 9.4 Fallback, manual, when the app is down

All commands run on the single host. **Every step destroys data. There is no undo.**

```bash
# 0. Back up first if anything in this environment matters.
$COMPOSE exec -T postgres pg_dump -U archiva -Fc archiva > "pre-reset-$(date +%F-%H%M).dump"

# 1. Stop the writers. This drops the connection pool, so the app cannot keep
#    serving against a schema that is about to disappear.
$COMPOSE stop api worker

# 2. Wipe. WARNING: drops every table and every row in this environment.
$COMPOSE exec -T postgres psql -U archiva -d archiva \
  -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

# 3. Re-migrate to head through the runner. Never a raw .sql file.
$COMPOSE run --rm migrate

# 4. Reseed with this environment's seed.
$COMPOSE run --rm api bun run db:seed:qa

# 5. Purge the blob prefix and drop the search index.
$COMPOSE exec -T minio mc rm --recursive --force local/archiva/t/ || true
$COMPOSE exec -T api sh -c 'curl -fsS -X DELETE "$OPENSEARCH_URL/${OPENSEARCH_INDEX_PREFIX}-pages"' || true

# 6. Flush the queue so no job from the old dataset is redelivered.
$COMPOSE exec -T valkey valkey-cli FLUSHALL

# 7. Restart. The pool reconnects to the fresh schema.
$COMPOSE up -d api worker
```

### 9.5 Verify the reset

```bash
# 1. Health ok, and postgres specifically ok.
curl -fsS -H "Authorization: Bearer $HEALTH_TOKEN" \
  "https://$ARCHIVA_DOMAIN/health/ready" | jq '.status, .checks.postgres'

# 2. A known seed row exists.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT title FROM documents WHERE title = 'kontrak-kerjasama.pdf';"

# 3. Nothing a tester left behind survived.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT count(*) AS documents FROM documents;"
```

### 9.6 Seeds

| Seed | Command | Contents |
|---|---|---|
| `dev` | `bun run db:seed:dev` | One tenant, four users covering every role, the reserved `Uncategorized` plus four categories, roughly 20 documents across processing states including one FAILED and one password-protected |
| `qa` | `bun run db:seed:qa` | The dev set plus every fixture the criteria name: `fixture-reporting-01.pdf` (AC-06.01), `kontrak-kerjasama.pdf` with "klausul-kerahasiaan" on page 15 (AC-33.01), a known-duplicate pair (AC-03.01), a 25 MB file (AC-01.06), an EICAR test file (AC-46.02) |

Both live in `packages/db/src/seeds/`, are version-controlled, and are idempotent: running one twice leaves the same state, and running it against a partially seeded database completes it rather than failing on a conflict.

## 10. Inspecting and debugging the database

A cookbook. For a reset, use section 9 rather than assembling one from these.

### 10.1 Interactive session

```bash
$COMPOSE exec postgres psql -U archiva -d archiva
```

Useful once inside: `\dt` list tables, `\d documents` describe one, `\dx` extensions, `\q` quit.

### 10.2 One-off queries

```bash
# Non-interactive, scriptable.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT processing_state, count(*) FROM documents GROUP BY 1 ORDER BY 2 DESC;"

# Tenant isolation spot check: every row must carry a tenant.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT count(*) FROM documents WHERE tenant_id IS NULL;"
```

### 10.3 Size and health

```bash
# Database size.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT pg_size_pretty(pg_database_size('archiva'));"

# Largest tables. document_pages dominates: 100k documents times 50 pages.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS size
   FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;"

# Open connections against the pool ceiling in DATABASE_POOL_MAX.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT state, count(*) FROM pg_stat_activity WHERE datname='archiva' GROUP BY 1;"
```

### 10.4 Migration ledger

```bash
# What the ledger believes is applied. If this disagrees with the schema,
# someone applied SQL outside the runner. See technical-specs/06-data-model.md 6.11.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 10;"
```

### 10.5 Dump and restore

```bash
# Dump. Custom format, restorable selectively.
$COMPOSE exec -T postgres pg_dump -U archiva -Fc archiva > "archiva-$(date +%F).dump"

# Schema only, to diff two environments.
$COMPOSE exec -T postgres pg_dump -U archiva --schema-only archiva > schema.sql

# Restore. WARNING: --clean drops existing objects first. Every row written
# since the dump is lost.
cat archiva-2026-09-10.dump | $COMPOSE exec -T postgres \
  pg_restore -U archiva -d archiva --clean --if-exists
```

### 10.6 Logs

```bash
$COMPOSE logs -f api                  # follow
$COMPOSE logs --since 15m worker      # recent worker activity
$COMPOSE logs api | grep '"level":50' # pino errors only
$COMPOSE logs migrate                 # why a migration failed
```

Logs are structured JSON, one line per request. Authorization headers, cookies and every key in `SECRET_KEYS` are redacted by the serialiser. If a secret appears in a log, that is a defect to fix in the serialiser, not a log to quietly delete.

### 10.7 The other datastores

```bash
# OpenSearch: index health and document count.
$COMPOSE exec -T api sh -c 'curl -fsS "$OPENSEARCH_URL/_cat/indices?v"'

# Valkey: queue depth.
$COMPOSE exec -T valkey valkey-cli LLEN "bull:document.process:wait"

# MinIO: blob count for one tenant.
$COMPOSE exec -T minio mc ls --recursive local/archiva/t/<tenant-id>/ | wc -l
```

### 10.8 Common failures

| Symptom | Check | Likely cause |
|---|---|---|
| `api` exits at boot, no HTTP | `$COMPOSE logs api \| head -20` | Config validation. The `config:` line names the variable. |
| Documents stuck at `Antre` | `$COMPOSE ps worker`, queue depth in 10.7 | Worker down or Valkey unreachable |
| Documents reach `Gagal` with `ai_unavailable` | `$COMPOSE logs worker \| grep ai` | Provider key, quota, or reachability |
| Search returns nothing for a READY document | `_cat/indices` in 10.7 | Index missing after a restore. Reindex. |
| Upload returns 500 | `$COMPOSE logs api`, then `$COMPOSE ps clamav` | ClamAV down; scanning is the first pipeline stage |
| Health `degraded` on `gotenberg` | `$COMPOSE ps gotenberg` | Office preview unavailable; PDFs unaffected |
| Health `down` on `postgres` | `$COMPOSE ps postgres` | The system is down. Nothing else matters until it is up. |

## 11. Known gaps

This plan documents the intended operation. These pieces do not exist yet, and each is named here so an operator does not follow a step that cannot work.

| Gap | Effect on this runbook | Closes with |
|---|---|---|
| **Both seeds throw `SCAFFOLD`** | Steps 5.8 and 9.4 step 4 fail today. The reset procedure is correct but not yet executable. | `TL-S0-03` |
| **No migrations on disk**, only `.gitkeep` | Step 5.7 applies nothing. Run `bun run db:generate` once the full schema lands. | `TL-S0-02` |
| **Only `tenancy` and the enums are modelled** | A reset produces a partial schema. | `TL-S0-02` |
| **No wildcard TLS** | Caddy needs a DNS-01 plugin and a provider token; the stock image has neither. Tenant subdomains cannot get certificates. | Choose a DNS provider, then rebuild Caddy with its plugin |
| **`db:reindex` does not exist** | There is no way to rebuild the search index short of a full reset. | Add alongside `BE-S4-01` |
| **No automated backup** | Every `pg_dump` in this document is manual. A destructive migration with no prior dump is unrecoverable. | Schedule a nightly dump with offsite retention before production |
| **No deploy automation past image publish** | CI publishes images; deployment is the manual sequence in sections 5 and 6. | Acceptable at release 1, single host |

The first three block SIT. Nothing here blocks continued development.
