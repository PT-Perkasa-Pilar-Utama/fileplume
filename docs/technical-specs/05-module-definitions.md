# 05 — Module Definitions

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

Eight modules. Each entry gives its responsibility, its full public interface (invariants, error modes and ordering, not just signatures), the entities it owns, its seams, why it is deep, and the acceptance criteria it serves.

A module's **interface** is everything a caller must know to use it correctly. Signatures are the smallest part of that. Where an invariant is stated below, callers may rely on it and the module may not break it without a version note.

**Cross-module rule:** modules import each other only through `packages/<module>/src/index.ts`. Importing anything under `internal/` is a lint error, made physically impossible by the single-entry `exports` map in 03-repository-structure.md 3.2.

## 5.1 tenancy

**Responsibility.** Owns the tenant boundary and everything scoped to a whole organisation: its identity, its configuration parameters, and its storage accounting.

**Owns.** `tenants`, `tenant_config`.

**Public interface.**

```ts
resolveTenant(subdomain: string): Promise<Tenant | null>
createTenant(input: NewTenant): Promise<Result<Tenant, TenantNameTaken | SubdomainTaken>>
getConfig(tenantId: TenantId): Promise<TenantConfig>
setConfigValue(tenantId, key: ConfigKey, value: string, actor: UserId)
  : Promise<Result<void, InvalidConfigValue | ValueOutOfRange | NotEditableByTenant>>
reserveQuota(tenantId, bytes: number): Promise<Result<QuotaReservation, QuotaExceeded>>
commitQuota(reservation: QuotaReservation): Promise<void>
releaseQuota(reservation: QuotaReservation): Promise<void>
getQuotaUsage(tenantId): Promise<{ usedBytes, quotaBytes, percent }>
```

**Invariants and ordering.**

1. `ConfigKey` is a closed union of known parameters, never a free string (grooming D16). An unknown key is a type error, not a silent miss.
2. `storage_quota` is writable only by Super Admin. `setConfigValue` returns `NotEditableByTenant` for it regardless of the caller's role inside the tenant. AC-42.01 shows it read-only.
3. Quota is reserved before a blob is written and committed after, or released on failure. Reservations expire after 15 minutes and are swept.
4. `reserveQuota` is the only correct way to check quota. Reading `getQuotaUsage` and then deciding is a race, and AC-35.04 tests exactly that race.

**Seams.** None. Pure database.

**Why deep.** Four callers need quota and none needs to know it is enforced by a reservation row with an expiry rather than a counter. Deleting this module scatters the reservation protocol into `catalog` and pushes config validation into route handlers.

**Serves.** US-43, US-42, US-35.

## 5.2 identity

**Responsibility.** Who the caller is, and whether their role clears the floor a route requires.

**Owns.** `users`, `sessions`, plus better-auth's tables.

**Public interface.**

```ts
type Role = "member" | "head_of_team" | "admin_tenant" | "super_admin"

authenticate(email: string, password: string): Promise<Result<Session, InvalidCredentials>>
resolveSession(cookie: string): Promise<Result<Principal, SessionExpired | SessionRevoked>>
endSession(sessionId): Promise<void>
requireRole(floor: Role): MiddlewareHandler
hasRoleAtLeast(principal: Principal, floor: Role): boolean
```

**Invariants and ordering.**

1. Roles are totally ordered: member is below head_of_team is below admin_tenant. `super_admin` is not in that chain; it sits outside every tenant and never carries a `tenantId` (grooming D10).
2. `requireRole` describes a **floor**, not a set, so adding a role later does not require editing existing guards.
3. `resolveSession` reads the database on every call. Deliberate: AC-14.02 requires a permission change to be effective on the very next request, which a cached or stateless credential cannot deliver.
4. Session idle expiry (AC-40.04) is evaluated on read, not by a sweeper, so an expired session is never briefly valid.
5. `authenticate` returns the same `InvalidCredentials` for an unknown email and a wrong password, in the same time. AC-40.02 shows one message for both.

**Seams.** None in release 1. If an external IdP appears under US-31, `authenticate` becomes the port.

**Why deep.** Every route depends on it and none contains a role comparison. Deleting it puts session parsing, expiry evaluation and role ordering into 40-odd handlers, which is precisely how AC-41.05 gets violated by omission.

**Serves.** US-40, US-41, and the server-side half of every 403 criterion.

## 5.3 catalog

**Responsibility.** The document itself: its bytes, its versions, its identity, and getting it back out.

**Owns.** `documents`, `document_versions`.

**Public interface.**

```ts
upload(input: { tenantId, uploaderId, filename, stream, sizeBytes })
  : Promise<Result<Document, UnsupportedType | TooLarge | QuotaExceeded
                            | DuplicateContent | BatchTooLarge>>
addVersion(documentId, input): Promise<Result<DocumentVersion, IdenticalContent | NotFound>>
listVersions(documentId): Promise<DocumentVersion[]>
getDocument(tenantId, documentId): Promise<Result<Document, NotFound>>
openBlob(versionId): Promise<ReadableStream>
renderPreview(versionId): Promise<Result<PreviewPayload, PreviewUnavailable>>
download(principal, documentId, versionId?)
  : Promise<Result<DownloadTicket, DownloadForbidden | NotFound>>
downloadBulk(principal, documentIds): Promise<Result<BulkDownload, TooManySelected>>
setProcessingState(documentId, state, reason?): Promise<void>
```

**Invariants and ordering.**

1. `DuplicateContent` is decided on `(tenant_id, content_hash)`. A filename match is never a duplicate and never a new version (grooming D5). Full matrix in 06-data-model.md 6.6.
2. A new version is created only through `addVersion` against a named document. There is no implicit path from `upload`.
3. Version numbers are consecutive integers per document, allocated under a row lock, so AC-21.04's concurrent case cannot produce a gap or a duplicate.
4. `upload` reserves quota before writing the blob and commits after the row is inserted. On any failure it releases.
5. `download` consults `classification.canDownloadCategory` and `identity.hasRoleAtLeast`, and writes an `activity` event on **both** outcomes. AC-13.02 requires the denial to appear in the audit trail.
6. `download` is idempotent per request id, so AC-10.04's double click yields one file and one audit row.
7. `downloadBulk` omits documents the principal may not download and reports the count. It never fails the whole request because one member of the selection is restricted (AC-11.02).
8. `getDocument` returns `NotFound`, never `Forbidden`, for a document in another tenant. AC-43.03 must not leak existence.

**Seams.** `BlobStore` (S3 adapter in production, in-memory in tests). `DocumentConverter` (Gotenberg adapter, stub in tests).

**Why deep.** `upload` hides eight validations, a hash computation, a quota protocol, a blob write, two inserts and a job enqueue behind one call that returns a document or a typed reason. The deletion test is decisive: removing it simplifies nothing, it relocates the quota-and-hash-and-version protocol into a route handler where the next endpoint re-implements two thirds of it.

**Serves.** US-01, US-03, US-09, US-10, US-11, US-21, US-38.

## 5.4 classification

**Responsibility.** The category taxonomy, what each document is filed under, and whether a category may be downloaded.

**Owns.** `categories`, `category_permissions`, `document_classification`.

**Public interface.**

```ts
createCategory(tenantId, name, actor): Promise<Result<Category, DuplicateName | Forbidden>>
listCategories(tenantId): Promise<Category[]>
setDownloadPermission(tenantId, categoryId, active, actor)
  : Promise<Result<void, Forbidden | NotFound>>
canDownloadCategory(tenantId, categoryId): Promise<boolean>
suggest(documentId, categoryId, source: "ai", confidence): Promise<void>
confirm(documentId, categoryId, actor): Promise<Result<void, NotFound | NotOwner>>
listUnconfirmed(tenantId, viewer: Principal): Promise<Document[]>
isVisibleToTenant(documentId): Promise<boolean>
```

**Invariants and ordering.**

1. A new category's download permission is **Inactive** (AC-45.01). There is no way to create one already active; activating is a second, audited action.
2. The AI never creates a category. `suggest` accepts only an existing `categoryId`; an unclassifiable document gets the reserved `Uncategorized` category (grooming D3, AC-06.03).
3. `confirm` records the prior AI suggestion and the confirming actor, because that pair is the accuracy metric behind AC-12.03.
4. `isVisibleToTenant` implements the confirmation window from grooming D4: unconfirmed and younger than `pending_confirmation_days` means uploader-only; older, or confirmed, means tenant-wide. Head of Team and above bypass it.
5. `canDownloadCategory` reads current state, never a cache with a TTL. AC-14.02 says "sejak saat itu".

**Seams.** None.

**Why deep.** It answers "may this be downloaded" and "may this be seen" for every other module without any of them learning what a category is. Note what is deliberately *not* here: role comparison. That stays in `identity`, and `catalog` composes the two. A combined `policy` module was considered and rejected as shallow, since it would hold no logic of its own while needing the internals of two modules.

**Serves.** US-45, US-02, US-06, US-14, US-34.

## 5.5 enrichment

**Responsibility.** Everything the system learns about a document after it lands, and the state machine that governs the learning.

**Owns.** `document_text`, `document_pages`, `document_tags`, `document_metadata`, `ai_field_overrides`.

**Public interface.**

```ts
enqueue(documentId): Promise<void>
process(documentId): Promise<void>
getState(documentId): Promise<{ state: ProcessingState, reason?: FailureReason, updatedAt }>
overrideField(documentId, field: AiField, value, actor): Promise<Result<void, Forbidden | NotFound>>
listTags(documentId): Promise<Tag[]>
topTags(tenantId, limit: 10): Promise<TagCount[]>
```

**Invariants and ordering.**

1. `ProcessingState` is QUEUED, then PROCESSING, then READY or FAILED. No other transition exists. Full machine in 12-document-processing-pipeline.md.
2. Stage order is fixed and not configurable: **scan, extract, classify, index.** Scanning first is a security property, not an optimisation; nothing untrusted reaches the extractor.
3. `process` is idempotent. A redelivered job for a READY document is a no-op. Required, not best-effort: BullMQ guarantees at-least-once.
4. Transient failures retry three times with exponential backoff and the document stays PROCESSING throughout, so a user never sees a flicker to FAILED and back (AC-44.02).
5. A FAILED document remains readable and downloadable (AC-44.03). Failure removes derived data, never the document.
6. Malware detection is not a failure state. Document and blob are deleted and an audit event is written (AC-46.02).
7. At most three tags are stored, chosen by descending confidence, truncated at write time not read time (AC-05.05).
8. `overrideField` stores the original AI value permanently alongside the correction. Without it AC-12.03 has nothing to measure.

**Seams.** `MalwareScanner` (ClamAV, always-clean stub). `TextExtractor` (native plus hosted OCR, Tesseract on-premises, fixture stub in tests). `AiProvider` (Anthropic, deterministic stub in tests). All injected at the worker composition root.

**Why deep.** `process(documentId)` is one function behind which sit four external systems, a retry policy, a state machine and a compensation path. The queue, the API retry endpoint and the reset-state seeder all use that one call. The interface is deliberately narrow so widening it later is additive.

**Serves.** US-04, US-05, US-06, US-44, US-47.

## 5.6 search

**Responsibility.** Write documents into the index and answer queries against it.

**Owns.** No tables. Owns the OpenSearch index and its mapping.

**Public interface.**

```ts
indexDocument(doc: IndexableDocument): Promise<void>
removeDocument(tenantId, documentId): Promise<void>
searchTitles(tenantId, q: string, page): Promise<Result<Hits, QueryTooShort>>
searchContent(tenantId, q: string, page): Promise<Result<ContentHits, QueryTooShort>>
findRelated(tenantId, documentId, limit: 5): Promise<Hit[]>
reindexTenant(tenantId): Promise<JobId>
indexLagSeconds(): Promise<number>
```

**Invariants and ordering.**

1. Every query carries a mandatory tenant filter applied inside this module. A caller cannot construct a query that omits it (AC-43.02).
2. `searchContent` returns page number and a highlighted fragment per hit, because AC-33.01 requires the snippet from the specific page.
3. Queries shorter than two characters return `QueryTooShort` without touching OpenSearch (AC-07.03).
4. Indexing is asynchronous relative to upload. A document still PROCESSING is absent from content search and the caller surfaces that (AC-33.03).
5. `indexLagSeconds` exists so D13 alerting has a number to watch.

**Seams.** `SearchIndex` port: OpenSearch adapter in production, in-memory adapter in tests so search behaviour is testable without a container.

**Why deep.** Index naming, the page-document mapping, the analyzer chain, highlight configuration and the tenant filter all sit behind six methods. Deleting it means every caller learns the index layout, and the first one that forgets the tenant filter breaks AC-43.02 silently. Details in 13-search-indexing-strategy.md.

**Serves.** US-07, US-33, US-08.

## 5.7 activity

**Responsibility.** The record of what happened, and the aggregations read from it.

**Owns.** `audit_events`, `analytics_rollups`.

**Public interface.**

```ts
record(event: { tenantId, actorId, action: AuditAction, subjectType,
                subjectId, outcome, metadata? }): Promise<void>
listAudit(tenantId, filter, page): Promise<Page<AuditEvent>>
dashboard(tenantId): Promise<DashboardMetrics>
```

**Invariants and ordering.**

1. One generic event shape from day one (grooming D14). Adding an action later costs a union member, not a migration.
2. `outcome` is `allowed` or `denied`. Denials are first-class, because AC-13.02 requires them visible.
3. Audit rows are append-only. There is no update or delete path in the public surface.
4. `record` never throws into the caller's path. A failure to audit is logged and alerted, but does not fail a download the user was entitled to.
5. `dashboard` reads rollups, not raw events. AC-12.04's empty tenant returns zeros, never null.

**Seams.** None.

**Why deep.** Analytics is a read model over the ledger audit writes. Split apart, analytics would reach into audit's tables (breaking the import rule) or audit would expose a wide query surface that defeats its own depth. One module, two views.

**Serves.** US-13, US-12.

## 5.8 platform

**Responsibility.** The operational contract that deployment and QA rely on.

**Owns.** No tables. Owns the migration runner and the operational routes.

### 5.8.1 Health monitor

```
GET /health/live     liveness only, 200 whenever the process is up
GET /health/ready    readiness, checks every critical dependency
GET /health          alias for /health/ready
```

`/health/ready` response shape:

```json
{
  "status": "ok",
  "version": "1.4.2",
  "checks": {
    "postgres":   { "status": "ok", "latencyMs": 3 },
    "opensearch": { "status": "ok", "latencyMs": 11, "indexLagSeconds": 2 },
    "valkey":     { "status": "ok", "latencyMs": 1, "queueDepth": 4 },
    "blobStore":  { "status": "ok", "latencyMs": 22 },
    "clamav":     { "status": "ok", "signatureAge": "2h" },
    "gotenberg":  { "status": "ok", "latencyMs": 30 },
    "aiProvider": { "status": "degraded", "latencyMs": 1900 }
  }
}
```

Overall `status` is `ok`, `degraded` or `down`. HTTP 200 for ok and degraded, 503 for down. A dependency the system survives without (aiProvider, gotenberg) degrades; Postgres cannot degrade, it downs.

`/health/live` is public so a load balancer reaches it. `/health/ready` is guarded by a shared token in `HEALTH_TOKEN`, because the per-dependency breakdown names internal topology.

This is the redundancy measure that catches a half-broken state: the application running against a wiped or unreachable database on a separate host.

### 5.8.2 Reset database state

```
POST /admin/reset-state
Authorization: Bearer <RESET_API_TOKEN>
Content-Type: application/json

{ "seed": "dev" | "qa", "confirm": "reset-<APP_ENV>" }
```

Returns `202 Accepted` with a `jobId`; progress at `GET /admin/reset-state/:jobId`. It runs as a job because dropping, re-migrating and reseeding exceeds any sane request timeout.

Sequence: drop schema, run migrations from the ledger, run the selected idempotent seed, purge the blob bucket prefix, delete and recreate the OpenSearch index, flush the queue.

**Registered only when `APP_ENV` is one of `dev`, `test`, `sit`, `uat` and `ENABLE_RESET_API=true`.** In production the route does not exist and returns 404, because the registration branch never runs. Enforced at route registration, not by an authorization check. See 07-security.md 7.6.

**Serves.** Deployment and QA. No user story; it exists so QA can reset without a host session.

## 5.9 Shared packages

`packages/shared` holds the Zod contracts used by both api and web, the `Result` type, branded id types and the error taxonomy. It contains no behaviour and owns no tables.

`packages/config` parses and validates the environment once at startup and fails fast. No module reads `process.env` directly.
