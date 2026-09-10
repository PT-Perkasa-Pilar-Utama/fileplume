# Archiva Troubleshooting Guide

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Tech Lead  
**Status:** Living skeleton  
**Phase:** Release 1  

## How to use this guide

Indexed by **symptom**, because that is how you arrive: with an error, not a diagnosis. Find what you are seeing, not what you think is broken.

**Every entry here is `scaffolded`.** This system has no incident history yet, so these entries were reasoned from the architecture, specifically from its seams: the boundaries between components, where most production failures live. The *causes* are hypotheses. The *commands* are real and runnable against this stack. When a real incident confirms an entry, promote it (see [Adding an entry](#adding-an-entry)); until then, treat the ranking of causes as an educated guess.

Ordered by seam risk, not alphabetically. The first sections fail most often or hurt most.

This guide does not repeat [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md). For a failed update see its section 6.4, for the database cookbook section 10, for the reset procedure section 9, and for what is not built yet section 11.

Set the shell variables from `DEPLOYMENT_PLAN.md` 5.1 before running anything here:

```bash
export ARCHIVA_DOMAIN=sit.archiva.id
export COMPOSE="docker compose -f compose.yaml -f compose.prod.yaml"
```

## Fast triage

Run these four before reading further. They separate "everything is down" from "one thing is wrong".

```bash
# 1. Is anything running, and did something restart recently?
$COMPOSE ps

# 2. Are the dependencies healthy? postgres ok is non-negotiable.
curl -fsS -H "Authorization: Bearer $HEALTH_TOKEN" \
  "https://$ARCHIVA_DOMAIN/health/ready" | jq '.status, .checks'

# 3. Did something just deploy? Compare against the SHA you expect.
curl -fsS "https://$ARCHIVA_DOMAIN/health/live" | jq -r .version

# 4. What is the app actually complaining about? pino level 50 is error.
$COMPOSE logs --since 30m api worker | grep '"level":50' | tail -20
```

| Triage result | Go to |
|---|---|
| `postgres` not `ok` | [Database](#database) |
| A container is restarting | [Application runtime](#application-runtime) |
| Version is not what you deployed | `DEPLOYMENT_PLAN.md` 6.4 |
| Health green but users report errors | [Authentication and session](#authentication-and-session), [Multi-tenancy](#multi-tenancy-and-subdomains) |
| Documents stuck, health green | [Document pipeline](#document-pipeline) |

## Authentication and session

The highest-risk seam in this system. The session is read from the database on every request, the cookie has strict attributes, and tenants are subdomains. All three interact.

### Login succeeds, then every subsequent request returns 401

**Looks like:** `POST /auth/login` returns 200 with a user object, but the next call returns `{"error":{"code":"UNAUTHENTICATED","message":"Sesi Anda telah berakhir. Silakan login kembali"}}`. The browser shows no session cookie in DevTools despite a `Set-Cookie` in the login response.

**Likely causes:**

1. A `Domain` attribute is set on the cookie. The `__Host-` prefix forbids it, and the browser rejects the cookie silently, with no console error. This is the failure the `COOKIE_DOMAIN` removal in `technical-specs/11-environment-configuration.md` 11.4 exists to prevent; a reintroduced `COOKIE_DOMAIN` brings it straight back.
2. The response is not over HTTPS. `__Host-` requires `Secure`, so the cookie is dropped on plain HTTP.
3. `Path` is not `/`. `__Host-` requires it.
4. `WEB_ORIGIN` does not match the browser origin exactly, so CORS rejects the credentialed request.

**Confirm:**

```bash
# Inspect the actual Set-Cookie. A Domain= on a __Host- cookie is the bug.
curl -sD - -o /dev/null -X POST "https://$ARCHIVA_DOMAIN/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"budi@contohbaru.co.id","password":"..."}' | grep -i set-cookie

# Confirm no COOKIE_DOMAIN leaked back into the environment.
$COMPOSE exec -T api sh -c 'env | grep -i cookie' || echo "no cookie vars, correct"

# Confirm WEB_ORIGIN is exactly the browser origin, scheme included.
$COMPOSE exec -T api sh -c 'echo $WEB_ORIGIN'
```

**Fix:** Remove `COOKIE_DOMAIN` from `.env` and restart `api`. Ensure the request is HTTPS end to end; Caddy terminates TLS, so `api` must not be reached directly over HTTP from a browser. Correct `WEB_ORIGIN` to match the origin the SPA is served from.

**Prevent:** `packages/config` no longer accepts `COOKIE_DOMAIN`. Keep it that way. A cross-subdomain session would need `__Secure-` instead, which weakens the tenant boundary and is a deliberate architectural decision, not a config tweak.

**Status:** scaffolded, not yet seen in production

### A user is logged out roughly every 8 hours of inactivity

**Looks like:** `Sesi Anda telah berakhir. Silakan login kembali` on the next click after a break. Not a bug.

**Likely causes:**

1. Idle expiry, by design. `SESSION_IDLE_TTL_HOURS` defaults to 8 and satisfies AC-40.04.
2. Absolute expiry at 30 days.
3. `AUTH_SECRET` was rotated, which ends every session at once. If every user is logged out simultaneously, this is the cause, not idle expiry.

**Confirm:**

```bash
$COMPOSE exec -T api sh -c 'echo idle=$SESSION_IDLE_TTL_HOURS abs=$SESSION_ABSOLUTE_TTL_DAYS'

# Were sessions wiped wholesale, or are they ageing out individually?
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT count(*), min(last_seen_at), max(last_seen_at) FROM sessions;"
```

**Fix:** If this is idle expiry, no fix; it is the criterion. If `AUTH_SECRET` was rotated unintentionally, restore the previous value and restart; sessions issued under it become valid again.

**Prevent:** Treat `AUTH_SECRET` as a quarterly-rotation secret and announce rotations, per `technical-specs/07-security.md` 7.7.

**Status:** scaffolded, not yet seen in production

### A permission change does not take effect

**Looks like:** A Head of Team toggles a category to Inactive, but a member still downloads successfully.

**Likely causes:**

1. A caching layer was introduced in front of `canDownloadCategory`. The contract requires it to read current state with no TTL, because AC-14.02 says "sejak saat itu".
2. The client is showing a stale `downloadAllowed` flag while the server is refusing correctly. Check whether the download actually succeeded or the button merely looked enabled.

**Confirm:**

```bash
# What the database says right now.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT c.name, p.download_active, p.updated_at
   FROM category_permissions p JOIN categories c ON c.id = p.category_id
   ORDER BY p.updated_at DESC LIMIT 5;"

# Did a real download land, or only a UI affordance?
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT action, outcome, created_at FROM audit_events
   WHERE action = 'document.download' ORDER BY created_at DESC LIMIT 5;"
```

**Fix:** Remove any cache in front of the permission read. The session is already a database read per request, so this adds no round trip that is not already paid.

**Prevent:** The rule is in `CODING_STANDARD.md` 7.1 and asserted by the wiring card `FE-S5-07`.

**Status:** scaffolded, not yet seen in production

## Multi-tenancy and subdomains

Tenants are subdomains. Every request resolves a tenant before any handler runs, so a DNS or certificate gap presents as an application failure.

### A tenant subdomain returns 404 for every path

**Looks like:** `https://contohbaru.sit.archiva.id/api/v1/documents` returns 404, while `https://sit.archiva.id` works.

**Likely causes:**

1. No wildcard DNS record for `*.sit.archiva.id`.
2. No wildcard certificate, so TLS fails before the request reaches the app. This is a known gap: wildcard issuance needs DNS-01 and a Caddy build with the provider plugin (`DEPLOYMENT_PLAN.md` 11).
3. The tenant does not exist, or its subdomain differs from what was typed. Step 1 of the request order returns 404 for an unknown subdomain.

**Confirm:**

```bash
dig +short "contohbaru.$ARCHIVA_DOMAIN"

# Does TLS even complete for the subdomain?
echo | openssl s_client -servername "contohbaru.$ARCHIVA_DOMAIN" \
  -connect "contohbaru.$ARCHIVA_DOMAIN:443" 2>&1 | grep -E 'CN=|verify error'

# Does the tenant exist under that exact subdomain?
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT name, subdomain, status FROM tenants;"
```

**Fix:** Add the wildcard A record. For TLS, either complete the DNS-01 setup or, as an interim, run SIT on the single host name without tenant subdomains.

**Prevent:** Verify `dig` and the certificate SAN as part of `DEPLOYMENT_PLAN.md` 5.2, before the first tenant is created.

**Status:** scaffolded, not yet seen in production

### A user sees no documents, but the tenant has data

**Looks like:** An empty list with `Belum ada dokumen. Seret file ke area unggah untuk memulai`, while another user in the same tenant sees documents.

**Likely causes:**

1. The confirmation window, working as designed. An unconfirmed document is visible to its uploader alone until `pending_confirmation_days` elapses. AC-02.05 asserts exactly this.
2. The user is authenticated against a different tenant subdomain than they think.
3. Documents exist but every one is soft-deleted.

**Confirm:**

```bash
# Split the tenant's documents by what the window would hide.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT d.uploader_id, dc.confirmed_at IS NULL AS unconfirmed, count(*)
   FROM documents d LEFT JOIN document_classification dc ON dc.document_id = d.id
   WHERE d.deleted_at IS NULL GROUP BY 1,2;"

# What is the window set to for this tenant?
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT key, value FROM tenant_config WHERE key = 'pending_confirmation_days';"
```

**Fix:** Usually none; this is the criterion. A Head of Team sees everything and can file the backlog from the Uncategorized queue. To change the window, edit `pending_confirmation_days` via `PATCH /configuration/:key`.

**Prevent:** Nothing to prevent. Make sure support knows the window exists before treating it as a bug.

**Status:** scaffolded, not yet seen in production

## Database

`postgres` cannot degrade. If it is unhealthy the system is down, and nothing else in this guide matters until it is back.

### api exits immediately at startup, no HTTP at all

**Looks like:** `$COMPOSE ps` shows `api` restarting. Logs end with a line beginning `config:`.

**Likely causes:**

1. Config validation failed. `packages/config` exits non-zero before the server binds, deliberately, so a missing or malformed value never boots half-configured.
2. `DATABASE_URL` points somewhere unreachable.
3. `ENABLE_RESET_API` or `RESET_API_TOKEN` is set while `APP_ENV=production`; the schema refuses to boot.

**Confirm:**

```bash
# The config: lines name the offending variable and why.
$COMPOSE logs api | grep '^config:' | head
$COMPOSE logs api | head -20
```

**Fix:** Correct the named variable in `.env` and restart. See `DEPLOYMENT_PLAN.md` 6.4.

**Prevent:** Keep `.env.example` in sync with the schema, per `CODING_STANDARD.md` 9.2.

**Status:** scaffolded, not yet seen in production

### Requests hang, then fail under load

**Looks like:** Latency climbs, then requests time out. Health may still report `ok` because its probe uses its own connection.

**Likely causes:**

1. Connection pool exhaustion. Every request reads the session from the database, so pool pressure scales with request rate, not just with query complexity. `DATABASE_POOL_MAX` defaults to 10 for `api`.
2. A long-running query holding connections, most plausibly an unindexed scan over `document_pages`, the largest table by far.
3. Idle transactions never committed.

**Confirm:**

```bash
# Connection states against the ceiling.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT state, count(*) FROM pg_stat_activity WHERE datname='archiva' GROUP BY 1;"

# Anything running longer than 5 seconds.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT pid, now()-query_start AS age, left(query,80) FROM pg_stat_activity
   WHERE state <> 'idle' AND now()-query_start > interval '5 seconds' ORDER BY age DESC;"

$COMPOSE exec -T api sh -c 'echo pool=$DATABASE_POOL_MAX'
```

**Fix:** Terminate a runaway query with `pg_terminate_backend(pid)`. Raise `DATABASE_POOL_MAX` only after confirming Postgres `max_connections` has headroom across `api` plus `worker`.

**Prevent:** Index review on any new query touching `document_pages`. The tenant discriminator is the first column of every primary lookup index precisely so a query that forgets it is visibly slow.

**Status:** scaffolded, not yet seen in production

### The schema does not match what the code expects

**Looks like:** `relation "..." does not exist`, or a column missing, right after a deploy.

**Likely causes:**

1. `migrate` did not run, or ran and failed, and `api` started anyway.
2. Schema was applied outside the ledger by piping a `.sql` file, so the ledger no longer describes the database. `DEPLOYMENT_PLAN.md` 5.7 exists to prevent this.
3. The app image is newer than the migrations that were applied.

**Confirm:**

```bash
$COMPOSE ps -a migrate && $COMPOSE logs migrate | tail -20

# What the ledger believes is applied.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
```

**Fix:** Stop `api` and `worker`, run `$COMPOSE run --rm migrate`, then start them. If the ledger and schema genuinely disagree, restore from a dump rather than hand-patching; a hand-patched schema fails again on the next migration.

**Prevent:** Never apply SQL outside the runner. `DEPLOYMENT_PLAN.md` 5.7 states the rule and the reason.

**Status:** scaffolded, not yet seen in production

## Document pipeline

Four stages in fixed order: scan, extract, classify, index. Delivery is at-least-once, so idempotency failures show up here first.

### Documents stay at "Antre" and never progress

**Looks like:** The upload tray shows `Antre` indefinitely. The API is healthy and uploads succeed.

**Likely causes:**

1. The `worker` container is down or crash-looping. Nothing consumes the queue.
2. Valkey is unreachable from `worker`, so the consumer never attaches.
3. Jobs are being enqueued to a different queue name than the worker consumes.

**Confirm:**

```bash
$COMPOSE ps worker && $COMPOSE logs --since 15m worker | tail -20

# Is work piling up, and is anything consuming it?
$COMPOSE exec -T valkey valkey-cli LLEN "bull:document.process:wait"
$COMPOSE exec -T valkey valkey-cli LLEN "bull:document.process:active"

# Queue depth as the health monitor sees it.
curl -fsS -H "Authorization: Bearer $HEALTH_TOKEN" \
  "https://$ARCHIVA_DOMAIN/health/ready" | jq '.checks.valkey'
```

**Fix:** Restart `worker`. If it crash-loops, its first log lines name the cause, most often config validation as in the Database section.

**Prevent:** Alert on `checks.valkey.queueDepth` above a threshold for a sustained period, per grooming D13.

**Status:** scaffolded, not yet seen in production

### Documents reach "Gagal" in bulk with the same reason

**Looks like:** Many documents at `Gagal`. `GET /documents/:id/processing` reports `ai_unavailable` or `extraction_timeout` for most of them.

**Likely causes:**

1. The AI provider is unreachable, rate limiting, or the daily token budget is exhausted. This is a true-external dependency with no local fallback in release 1.
2. The OCR provider is failing the same way.
3. Retries were exhausted during an outage that has since ended, leaving documents parked at `Gagal`.

**Confirm:**

```bash
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT failure_reason, count(*) FROM documents
   WHERE processing_state = 'failed' GROUP BY 1 ORDER BY 2 DESC;"

$COMPOSE logs --since 1h worker | grep -iE 'ai|ocr|429|timeout' | tail -20

curl -fsS -H "Authorization: Bearer $HEALTH_TOKEN" \
  "https://$ARCHIVA_DOMAIN/health/ready" | jq '.checks.aiProvider'
```

**Fix:** Restore the provider, then reprocess the parked documents through `POST /documents/:id/reprocess`. A `FAILED` document keeps its blob, so nothing needs re-uploading.

Note the distinction that matters: `password_protected` and `unreadable_content` are permanent and skip retry entirely. Reprocessing those wastes budget and reaches the same answer.

**Prevent:** Alert on `checks.aiProvider` degrading, and on `AI_DAILY_TOKEN_BUDGET` consumption before it hits the ceiling.

**Status:** scaffolded, not yet seen in production

### The same document is processed twice

**Looks like:** Duplicate tags, doubled audit rows, or a `READY` document reverting to `PROCESSING`.

**Likely causes:**

1. An idempotency regression. `process()` must be a no-op on a `READY` document, because BullMQ guarantees at-least-once and a redelivery is normal, not exceptional.
2. A transition guard was removed, letting a delayed duplicate job move a `READY` document backwards.

**Confirm:**

```bash
# Duplicate audit rows for one document indicate a redelivery that did work.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT subject_id, action, count(*) FROM audit_events
   WHERE action = 'document.upload' GROUP BY 1,2 HAVING count(*) > 1;"

# More than three tags means truncation ran at read time, not write time.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT document_id, count(*) FROM document_tags GROUP BY 1 HAVING count(*) > 3;"
```

**Fix:** Restore the guard in `canTransition` and the `READY` short-circuit in `process()`. Both are unit-tested in `packages/enrichment/src/service.test.ts`; a regression here means those tests were changed.

**Prevent:** The tests exist. Do not weaken them to make a redelivery pass.

**Status:** scaffolded, not yet seen in production

### An upload succeeds, then the document vanishes

**Looks like:** `POST /documents` returned 201, the document appeared as `Antre`, and now `GET /documents/:id` returns 404.

**Likely causes:**

1. Malware was detected. This is by design: the document and its blob are deleted, an audit event is written, and there is no `failed` document to inspect. AC-46.02 requires it never be reachable.
2. The document belongs to another tenant and was never visible to this caller.

**Confirm:**

```bash
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT actor_id, subject_id, metadata, created_at FROM audit_events
   WHERE action = 'malware.detected' ORDER BY created_at DESC LIMIT 10;"
```

**Fix:** None. Working as specified. Tell the uploader the file was rejected as infected.

**Prevent:** Nothing. Confirm ClamAV signatures are current so detection stays accurate.

**Status:** scaffolded, not yet seen in production

## External integrations

Classified in `technical-specs/10-integration-points.md` 10.1 by what breaks when each fails.

### Health reports "degraded" and Office previews fail

**Looks like:** `checks.gotenberg` is not `ok`. PDF previews work; DOCX, XLSX and TXT return `Preview tidak tersedia untuk dokumen ini`.

**Likely causes:** Gotenberg is down, out of memory, or unreachable at `GOTENBERG_URL`.

**Confirm:**

```bash
$COMPOSE ps gotenberg
$COMPOSE exec -T api sh -c 'curl -fsS "$GOTENBERG_URL/health"' || echo "unreachable from api"
$COMPOSE logs --since 30m gotenberg | tail -20
```

**Fix:** Restart `gotenberg`. Overall status stays 200 while degraded, so the orchestrator will not evict the container; that is deliberate.

**Prevent:** Gotenberg is local-substitutable and stateless. Restarting is always safe.

**Status:** scaffolded, not yet seen in production

### Uploads are accepted but nothing is ever scanned

**Looks like:** Documents sit at `Antre` or `Diproses`. `checks.clamav` is not `ok`, or `signatureAge` is large.

**Likely causes:**

1. ClamAV is still loading its signature database. It needs roughly 2 GB of RAM and a minute or more on a cold start; `compose.yaml` sets no memory limit, so on a small VPS it can be killed by the OOM killer.
2. Signature updates are failing, so `signatureAge` grows without bound.

**Confirm:**

```bash
$COMPOSE ps clamav
$COMPOSE logs --since 10m clamav | tail -20

# Was it OOM-killed?
docker inspect --format '{{.State.OOMKilled}} {{.State.ExitCode}}' \
  "$($COMPOSE ps -q clamav)"

curl -fsS -H "Authorization: Bearer $HEALTH_TOKEN" \
  "https://$ARCHIVA_DOMAIN/health/ready" | jq '.checks.clamav'
```

**Fix:** Give the host more memory, or the container an explicit reservation. Scanning is the first pipeline stage by design, so nothing untrusted reaches a parser; the correct behaviour when ClamAV is down is that processing halts rather than proceeding unscanned.

**Prevent:** Set a memory reservation for `clamav` in the compose file and alert on `signatureAge`.

**Status:** scaffolded, not yet seen in production

## Search

### Content search returns nothing for a document that is READY

**Looks like:** A phrase visibly present in a document returns `Tidak ada hasil yang ditemukan`.

**Likely causes:**

1. The index was lost, most plausibly after a database restore, which does not restore OpenSearch. `DEPLOYMENT_PLAN.md` 8.1 warns about this.
2. The document is `READY` but its index stage failed, leaving `index_failed`.
3. `OPENSEARCH_INDEX_PREFIX` differs from the environment that wrote the index, so queries hit an empty index.
4. The query is under two characters and was refused before OpenSearch was touched.

**Confirm:**

```bash
# Does the index exist, and is its document count plausible?
$COMPOSE exec -T api sh -c 'curl -fsS "$OPENSEARCH_URL/_cat/indices?v"'
$COMPOSE exec -T api sh -c 'echo prefix=$OPENSEARCH_INDEX_PREFIX'

# Documents extracted but never indexed.
$COMPOSE exec -T postgres psql -U archiva -d archiva -c \
  "SELECT processing_state, failure_reason, count(*) FROM documents GROUP BY 1,2;"

curl -fsS -H "Authorization: Bearer $HEALTH_TOKEN" \
  "https://$ARCHIVA_DOMAIN/health/ready" | jq '.checks.opensearch'
```

**Fix:** Reindex the tenant. There is no `db:reindex` command yet (`DEPLOYMENT_PLAN.md` 11), so today the paths are a full reset in a non-production environment, or reprocessing affected documents via `POST /documents/:id/reprocess`.

**Prevent:** Add `db:reindex` alongside `BE-S4-01`. Treat a database restore as implying a reindex.

**Status:** scaffolded, not yet seen in production

### Search is slow, or OpenSearch restarts under load

**Looks like:** Searches exceed the 3-second budget in AC-07.01 and AC-33.01, or the container restarts during indexing.

**Likely causes:**

1. Heap exhaustion. `compose.yaml` sets `-Xms512m -Xmx512m`, far below what the `08-nfr` target of roughly 5M page documents per tenant needs. This is the most likely capacity failure in the system.
2. Bulk indexing competing with queries on one node.
3. Disk pressure pushing the index read-only.

**Confirm:**

```bash
$COMPOSE exec -T api sh -c 'curl -fsS "$OPENSEARCH_URL/_cluster/health?pretty"'
$COMPOSE exec -T api sh -c 'curl -fsS "$OPENSEARCH_URL/_nodes/stats/jvm?pretty"' | grep -A3 heap_used_percent
docker stats --no-stream "$($COMPOSE ps -q opensearch)"
df -h
```

**Fix:** Raise `OPENSEARCH_JAVA_OPTS` and give the host memory to back it. A `red` cluster status means unassigned shards and partial results.

**Prevent:** Size the heap against the real corpus before SIT sign-off. The 512 MB value is a development default that was never revised.

**Status:** scaffolded, not yet seen in production

## Object storage

### Upload returns 500, or a download streams an empty file

**Looks like:** `POST /documents` fails with `INTERNAL_ERROR`, or a download returns zero bytes.

**Likely causes:**

1. MinIO or S3 unreachable, or the bucket does not exist.
2. Wrong credentials, or `S3_FORCE_PATH_STYLE` false against MinIO, which needs true.
3. The blob key prefix did not match the active tenant and the adapter refused it. That refusal is a safety property, not a bug.
4. Host disk full.

**Confirm:**

```bash
curl -fsS -H "Authorization: Bearer $HEALTH_TOKEN" \
  "https://$ARCHIVA_DOMAIN/health/ready" | jq '.checks.blobStore'
$COMPOSE exec -T api sh -c 'echo "$S3_ENDPOINT bucket=$S3_BUCKET path_style=$S3_FORCE_PATH_STYLE"'
$COMPOSE exec -T minio mc ls local/archiva/ | head
df -h
```

**Fix:** Create the bucket, correct credentials, set `S3_FORCE_PATH_STYLE=true` for MinIO. Restart `api` and `worker` after any change; config is read once at startup.

**Prevent:** Quota accounting rejects an upload before the blob write, so a full disk should be rare. Alert on host disk separately; the quota protocol does not know about it.

**Status:** scaffolded, not yet seen in production

## Reverse proxy and TLS

### 502 from Caddy

**Looks like:** A Caddy 502 page in the browser, and the same from `curl`.

**Likely causes:**

1. `api` is not up, or not healthy yet.
2. `api` is up but not reachable at `api:3000`, which is what the Caddyfile proxies to.
3. `api` crashed after Caddy started.

**Confirm:**

```bash
$COMPOSE ps api caddy
$COMPOSE logs --since 10m caddy | tail -20
$COMPOSE exec -T caddy wget -qO- http://api:3000/health/live || echo "api unreachable from caddy"
```

**Fix:** Restart `api`, then re-run the checks in `DEPLOYMENT_PLAN.md` 5.10.

**Status:** scaffolded, not yet seen in production

### Certificate issuance fails

**Looks like:** Caddy logs ACME errors in a loop. HTTPS never becomes available.

**Likely causes:**

1. DNS does not point at the host yet, so the HTTP-01 challenge cannot reach it.
2. Port 80 blocked or occupied. The challenge needs it even though traffic ends on 443.
3. A wildcard was requested without a DNS-01 provider plugin. The stock image has none; this is the known gap in `DEPLOYMENT_PLAN.md` 11.
4. Let's Encrypt rate limits after repeated failures.

**Confirm:**

```bash
dig +short "$ARCHIVA_DOMAIN"
sudo ss -lntp | grep ':80 '
$COMPOSE logs caddy | grep -iE 'acme|challenge|rate limit' | tail -20
```

**Fix:** Point DNS and free port 80, then restart `caddy`. For wildcards, complete the DNS-01 setup. While rate-limited, use the staging endpoint rather than retrying against production.

**Prevent:** `DEPLOYMENT_PLAN.md` 5.2 checks DNS and port availability before any container starts, for exactly this reason.

**Status:** scaffolded, not yet seen in production

## Application runtime

### A container restarts in a loop

**Looks like:** `$COMPOSE ps` shows a climbing restart count.

**Likely causes:** In order: config validation failure, an unreachable dependency at startup, the OOM killer.

**Confirm:**

```bash
$COMPOSE ps
$COMPOSE logs <service> | head -30
docker inspect --format 'restarts={{.RestartCount}} oom={{.State.OOMKilled}} exit={{.State.ExitCode}}' \
  "$($COMPOSE ps -q <service>)"
docker stats --no-stream
free -h
```

**Fix:** Config failures name their variable in the first log lines. Exit 137 with `oom=true` means memory; on a small host the usual culprits are `opensearch` and `clamav`.

**Prevent:** Set memory reservations for `opensearch` and `clamav` before running SIT on a small VPS.

**Status:** scaffolded, not yet seen in production

### A user-facing message appears in English

**Looks like:** An error renders in English where the criterion specifies Indonesian.

**Likely causes:**

1. A message was built in a handler instead of coming from `ERROR_MESSAGES`.
2. An unmapped error fell through to `INTERNAL_ERROR`, whose message is generic by design.

**Confirm:**

```bash
$COMPOSE logs --since 30m api | grep '"level":50' | tail -20
grep -rn "message:" apps/api/src/routes/ | grep -v ERROR_MESSAGES
```

**Fix:** Map the error to a typed code in `packages/shared/src/errors.ts` and return it through the boundary mapper.

**Prevent:** `CODING_STANDARD.md` 6.2 and 6.4, checked in review.

**Status:** scaffolded, not yet seen in production

## Adding an entry

This guide converges on reality only if real incidents land in it.

When an incident is diagnosed, do one of two things in the PR that fixes it:

1. **Promote a matching entry.** Change `**Status:** scaffolded, not yet seen in production` to `**Status:** confirmed YYYY-MM-DD, incident #<issue>`. Re-rank the causes to what actually happened, and replace any hypothesised command with the one that actually found it.
2. **Add a new entry** in the same six-field shape, under the seam it belongs to, if nothing matched.

Rules that keep this guide trustworthy:

- **Never downgrade a confirmed entry back to scaffolded.** Confirmed knowledge was paid for once already.
- Keep the symptom heading in the operator's words: the observable, not the diagnosis.
- Every `Confirm` command must run as written. An untested command is worse than no command at 2am.
- Reference `DEPLOYMENT_PLAN.md` rather than copying from it. Two copies of a procedure disagree eventually.
- If an incident reveals a gap in the architecture rather than the runbook, record it in `DEPLOYMENT_PLAN.md` 11 as well.
