# Archiva Task Breakdown

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Tech Lead  
**Status:** Approved  
**Phase:** Release 1  

The sprint board. Every card is one shippable, independently verifiable slice owned by one person.

## How to use this document

1. A card is not done until every AC it cites passes against a running server. See the Definition of Done.
2. `AC` cites real criteria from [business/acceptance-criteria.md](business/acceptance-criteria.md). No card invents one.
3. `Docs` cites the authoritative section. Read it before starting; do not re-derive a rule that is already written down.
4. Card IDs are stable. When a card is split, the original id is retired and both halves get new ones.
5. Sprint numbers and goals come from [business/sprint-breakdown.md](business/sprint-breakdown.md). Sprint 0 is the only addition, and it carries no user story because it is scaffold.

## Engineer composition

| Placeholder | Role | Scope |
|---|---|---|
| `TL` | Tech Lead | Sprint 0 scaffold, module seams, worker composition, CI, operational endpoints |
| `BE1` | Backend | Every API operation in [api-specs/](api-specs/), the pipeline stages, the search index |
| `FE1` | Frontend | Every screen, the viewer, the upload tray, and the client half of each wiring card |

One backend and one frontend engineer means backend work serialises. Sprint 3 is the critical path: the pipeline, extraction and classification stages are 8 backend days inside a 17-day backend sprint that also carries the taxonomy, confirmation and correction work. If a sprint slips, it is that one.

## Work model

Sprint 0 produces a scaffold with the API contract stable. From Sprint 1 onward, backend and frontend work the same feature in parallel against the contract in [api-specs/](api-specs/), and a wiring card proves the seam.

**The wiring rule.** Where a feature has separate backend and frontend cards, the integration is its own card, owned by whoever owns the last card that unblocks it. Pointing the real client at the real server, mapping the live error envelope, and proving the AC end to end is work; it is not a rounding error on either side.

## Open items that affect this board

| Item | Effect | Source |
|---|---|---|
| AC-43.03 and AC-43.04 say 403; the security spec says 404 | Cards implement 404 and the AC text needs amending. Raise via `/grooming`. | [api-specs/01-conventions.md](api-specs/01-conventions.md) 1.13 |
| AC-43.02 is a Sprint 1 criterion that needs search | Deferred to `BE-S4-07`, which proves it once the index exists. Flagged rather than moved silently. | [business/sprint-breakdown.md](business/sprint-breakdown.md) |
| No AC covers user administration | Users are created by an administrator ([technical-specs/09-authentication-authorization.md](technical-specs/09-authentication-authorization.md) 9.5) but no story covers the screen. Seeds cover it for release 1. Raise via `/grooming` if a UI is expected. | |

---

## Sprint 0: Fondasi Teknis

Stories: none. Scaffold only.  
Goal: a running stack, a migrated database, a validated environment, and a route skeleton that enforces the conventions, so Sprint 1 writes features rather than plumbing.

### Tech Lead

| Card ID | PM Card Title | Task Description | AC | Owner | Est | Docs |
|---|---|---|---|---|---|---|
| TL-S0-01 | Stand up the monorepo and toolchain | Bun workspace with `apps/api`, `apps/worker`, `apps/web` and the eight `packages/`. TypeScript strict with `noUncheckedIndexedAccess`, ESM only, Biome for lint and format, exact version pins and a committed lockfile. Enforce the single-entry `exports` map so importing another module's `internal/` fails to compile. | — | TL | 1 | [technical-specs/03-repository-structure.md](technical-specs/03-repository-structure.md) 3.1, 3.2; [04-tech-stack.md](technical-specs/04-tech-stack.md) 4.10 |
| TL-S0-02 | Model the schema and ship the migration runner | Drizzle schema for every table, one file per owning module. Native enums mirrored as TypeScript unions. Add `access.denied` and `search.performed` to `audit_action`. Migration runner resolving its folder relative to its own module and reading `DATABASE_URL` from the environment, never an absolute path and never an inlined string. | — | TL | 3 | [technical-specs/06-data-model.md](technical-specs/06-data-model.md) 6.1 to 6.11 |
| TL-S0-03 | Write the dev and qa seeds | Two idempotent seeds keyed on stable natural keys. `dev`: one tenant, four users covering every role, the reserved `Uncategorized` category plus four realistic ones, roughly 20 documents across processing states. `qa`: the dev set plus every fixture the criteria name by filename. | AC-06.01, AC-33.01, AC-03.01, AC-01.06, AC-46.02 | TL | 2 | [technical-specs/06-data-model.md](technical-specs/06-data-model.md) 6.11; [api-specs/10-system.md](api-specs/10-system.md) 10.4 |
| TL-S0-04 | Compose the full dependency stack | Docker Compose bringing up PostgreSQL 17, OpenSearch 2.x, Valkey 8, MinIO, ClamAV, Gotenberg and Caddy, with a one-shot migrate container that exits before `api` and `worker` start. Images pinned to a minor tag and a digest. | — | TL | 2 | [technical-specs/02-system-architecture.md](technical-specs/02-system-architecture.md) 2.4; [04-tech-stack.md](technical-specs/04-tech-stack.md) 4.4, 4.8 |
| TL-S0-05 | Validate the environment at startup | `packages/config` parsing every variable with Zod once at boot into a frozen object, exiting non-zero on a missing or malformed value. Refuse startup when `ENABLE_RESET_API` or `RESET_API_TOKEN` is set while `APP_ENV=production`. Keep `.env.example` in sync and fail CI when a schema key is missing from it. | — | TL | 1 | [technical-specs/11-environment-configuration.md](technical-specs/11-environment-configuration.md) 11.1 to 11.8 |
| TL-S0-06 | Build the Hono route skeleton | Success, collection and error envelopes. The error taxonomy with codes in English and messages in Indonesian. Tenant resolution from subdomain, session resolution, tenant-match assertion, and a `requireRole` helper whose floor argument is mandatory so an unguarded route fails to compile. Secure headers, CORS from `WEB_ORIGIN`, origin check on mutating requests, rate limiters. | — | TL | 2 | [api-specs/01-conventions.md](api-specs/01-conventions.md) 1.4 to 1.12; [technical-specs/07-security.md](technical-specs/07-security.md) 7.2, 7.4 |
| TL-S0-07 | Publish the shared contract package | `packages/shared` with the Zod schema for every request and response in the api-specs, the `Result` type, branded id types and the error taxonomy. Wire `@hono/zod-openapi` so the OpenAPI document is generated from the same schemas the handlers validate against. | — | TL | 1.5 | [api-specs/_index.md](api-specs/_index.md); [technical-specs/05-module-definitions.md](technical-specs/05-module-definitions.md) 5.9 |
| TL-S0-08 | Wire the CI gates | GitHub Actions running typecheck, lint, `bun test`, Testcontainers integration against real PostgreSQL and real migrations, and Playwright against a composed stack. Include the assertion that a production-configured app returns 404 for `POST /admin/reset-state`. | — | TL | 2 | [technical-specs/04-tech-stack.md](technical-specs/04-tech-stack.md) 4.7; [07-security.md](technical-specs/07-security.md) 7.6.2 |

---

## Sprint 1: Fondasi Tenant dan Akses Pengguna

Stories: US-43, US-40, US-41  
Goal: a tenant exists, a user can get in and out of it, the menu matches the role, and no request can reach across the tenant boundary.

### Backend

| Card ID | PM Card Title | Task Description | AC | Owner | Est | Docs |
|---|---|---|---|---|---|---|
| BE-S1-01 | Create and list tenants as Super Admin | `POST /tenants` and `GET /tenants` on the reserved `admin` subdomain. Name and subdomain uniqueness decided by constraints rather than a read-then-check. Seed the reserved `Uncategorized` category and its inactive permission row in the same transaction as the tenant. | AC-43.01 | BE1 | 2 | [api-specs/03-tenants.md](api-specs/03-tenants.md) 3.1, 3.2 |
| BE-S1-02 | Issue and end sessions | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`. Argon2id via `Bun.password`. Database-backed session, token hashed at rest, `__Host-` cookie. Unknown email and wrong password return the same code, the same message and in the same time. Absolute and idle expiry evaluated on read, never by a sweeper. | AC-40.01, AC-40.02, AC-40.03, AC-40.04 | BE1 | 3 | [api-specs/02-authentication.md](api-specs/02-authentication.md) 2.1 to 2.4 |
| BE-S1-03 | Enforce role floors and tenant isolation | Apply the five-step request order on every route. Repository helpers taking `TenantId` as a required first argument so a query that omits it does not typecheck. Blob key prefix assertion. A cross-tenant id returns 404, not 403, and writes an `access.denied` event against the caller's own tenant. | AC-41.05, AC-43.03, AC-43.04 | BE1 | 2 | [api-specs/01-conventions.md](api-specs/01-conventions.md) 1.7.1, 1.12; [technical-specs/07-security.md](technical-specs/07-security.md) 7.2, 7.3 |
| BE-S1-04 | Serve the health monitor and reset endpoint | `GET /health/live` public and dependency-free. `GET /health/ready` behind `HEALTH_TOKEN`, probing all seven dependencies with per-dependency status and latency. Reset-state as a job with its status endpoint, registered only outside production, guarded by the environment-bound `confirm` value. | — | BE1 | 2 | [api-specs/10-system.md](api-specs/10-system.md) 10.2 to 10.5 |
| BE-S1-05 | Prove cross-tenant isolation end to end | Depends on BE-S1-01 and BE-S1-03; BE-S1-03 lands last, so backend owns the wiring. Two-tenant fixture, then a direct-id attempt on every read path that exists so far: document detail, download, and the admin routes. Assert 404 and a denied audit row on each, and that no body carries metadata. Exit criterion is the integration suite green in CI. | AC-43.03, AC-43.04, AC-41.05 | BE1 | 1.5 | [technical-specs/07-security.md](technical-specs/07-security.md) 7.3; [api-specs/01-conventions.md](api-specs/01-conventions.md) 1.7.1 |

### Frontend

| Card ID | PM Card Title | Task Description | AC | Owner | Est | Docs |
|---|---|---|---|---|---|---|
| FE-S1-01 | Build the application shell | Vite SPA, TanStack Router with type-safe routes and search params, TanStack Query client, Zustand store, Tailwind and shadcn/ui theme layer. Route guard that redirects to Login on a 401 and surfaces the session-expired message. | — | FE1 | 2 | [technical-specs/04-tech-stack.md](technical-specs/04-tech-stack.md) 4.3 |
| FE-S1-02 | Build the Login screen | Email and password form with React Hook Form and the shared Zod resolver. Render the single failure message for both wrong-password and unknown-email. Profile display with name, role and avatar, falling back to initials when `avatarUrl` is null. Logout from the profile menu. | AC-40.01, AC-40.02, AC-40.03 | FE1 | 2 | [api-specs/02-authentication.md](api-specs/02-authentication.md) 2.2, 2.3 |
| FE-S1-03 | Derive navigation from the role | Render the sidebar from the `menus` array on `GET /auth/me` rather than a client-side role map, so the menu cannot drift from the permission behind it. Four role variants including the Super Admin case with no document menus. | AC-41.01, AC-41.02, AC-41.03, AC-41.04 | FE1 | 1.5 | [api-specs/02-authentication.md](api-specs/02-authentication.md) 2.4; [technical-specs/09-authentication-authorization.md](technical-specs/09-authentication-authorization.md) 9.3.3 |
| FE-S1-04 | Build the Manajemen Tenant screen | Super Admin table with name, subdomain, status and storage columns. Add-tenant form with the two fields, client-side subdomain validation matching the server rule, and the success message on 201. | AC-43.01 | FE1 | 1.5 | [api-specs/03-tenants.md](api-specs/03-tenants.md) 3.1, 3.2 |
| FE-S1-05 | Wire authentication end to end | Depends on BE-S1-02 and FE-S1-02; FE-S1-02 lands last, so frontend owns the wiring. Point the shell at the live API, map the real error envelope to the Indonesian messages, and prove the full loop: login, navigate, logout, then an idle-expired session showing the expiry message on the next click. Exit criterion is a Playwright flow covering all four criteria against the composed stack. | AC-40.01, AC-40.02, AC-40.03, AC-40.04 | FE1 | 1 | [api-specs/02-authentication.md](api-specs/02-authentication.md) 2.5; [01-conventions.md](api-specs/01-conventions.md) 1.6 |

---

## Sprint 2: Unggah, Simpan, dan Batas Penyimpanan

Stories: US-01, US-46, US-21, US-03, US-42, US-35, US-38  
Goal: a file gets in, is stored exactly once, respects the tenant's limits, is scanned before anyone else can reach it, and appears on the dashboard.

### Backend

| Card ID | PM Card Title | Task Description | AC | Owner | Est | Docs |
|---|---|---|---|---|---|---|
| BE-S2-01 | Accept a batch upload | `POST /documents` taking 1 to 20 multipart parts and returning per-file outcomes with a batch summary. Magic-byte type sniffing, never the extension or the client MIME type. Size check against the tenant's current limit. SHA-256 computed while streaming to the blob store. Files processed sequentially so a partial-quota batch is deterministic. | AC-01.01, AC-01.02, AC-01.03, AC-01.04, AC-01.05, AC-01.06, AC-03.02, AC-03.03 | BE1 | 3 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.2 |
| BE-S2-02 | Implement the quota reservation protocol | `reserveQuota` before the blob write, `commitQuota` after the row lands, `releaseQuota` on any failure, with 15-minute expiry and a sweeper. `GET /storage` reporting committed usage with the ok, warning and full levels and their server-owned messages. An interrupted upload consumes nothing. | AC-35.01, AC-35.02, AC-35.03, AC-35.04, AC-01.07 | BE1 | 2 | [api-specs/04-configuration.md](api-specs/04-configuration.md) 4.5, 4.6; [technical-specs/05-module-definitions.md](technical-specs/05-module-definitions.md) 5.1 |
| BE-S2-03 | Reject duplicates and handle the upload races | `UNIQUE (tenant_id, content_hash)` deciding duplicates on insert rather than on a read-then-check, so two simultaneous identical uploads yield one document and one typed refusal. Duplicate response carries the link to the existing document. Session resolved before the first byte and again before commit, so an expiring session leaves nothing behind. | AC-03.01, AC-03.04, AC-01.08 | BE1 | 1 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.2; [technical-specs/06-data-model.md](technical-specs/06-data-model.md) 6.6 |
| BE-S2-04 | Add explicit document versioning | `POST /documents/:id/versions` and `GET /documents/:id/versions`. Version numbers allocated under a row lock on the parent document so concurrent additions produce consecutive integers with no gap and no duplicate. Identical content against the current version refused. No implicit path from upload to a new version. | AC-21.01, AC-21.02, AC-21.03, AC-21.04 | BE1 | 2 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.6, 5.7 |
| BE-S2-05 | Serve tenant configuration | `GET /configuration` returning all three keys with defaults, ranges and editability. `PATCH` with type-then-range validation and no coercion, so a numeric-looking string is still refused. `DELETE` resetting to default by deleting the row rather than writing the default back. `storage_quota_gb` refused before any role check. | AC-42.01, AC-42.02, AC-42.03, AC-42.04, AC-42.05 | BE1 | 2 | [api-specs/04-configuration.md](api-specs/04-configuration.md) 4.1 to 4.4 |
| BE-S2-06 | List and read documents | `GET /documents` with pagination, sort and the empty-state message selection. `GET /documents/:id` with versions inline. Card fields: file type, title, upload date, uploader, processing state and its Indonesian label. | AC-38.01, AC-38.02, AC-38.03 | BE1 | 2 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.1, 5.4, 5.5 |
| BE-S2-07 | Scan uploads for malware | ClamAV over clamd as the first pipeline stage, before any parser sees the bytes. On detection, delete the blob and the document row and write a `malware.detected` event. Not a processing state: there is no failed document left to inspect. Until the scan clears, the document is visible to its uploader only. | AC-46.01, AC-46.02 | BE1 | 1.5 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.3; [technical-specs/12-document-processing-pipeline.md](technical-specs/12-document-processing-pipeline.md) 12.1 |
| BE-S2-08 | Wire malware rejection into the upload tray | Depends on BE-S2-07 and FE-S2-01; BE-S2-07 lands last, so backend owns the wiring. Prove that an EICAR fixture uploaded through the real tray returns 201, then disappears: the polling endpoint 404s, the tray swaps to the malware message, and the audit row exists. Exit criterion is a Playwright flow using the qa seed's EICAR file. | AC-46.01, AC-46.02 | BE1 | 1 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.3; [api-specs/07-enrichment.md](api-specs/07-enrichment.md) 7.2 |

### Frontend

| Card ID | PM Card Title | Task Description | AC | Owner | Est | Docs |
|---|---|---|---|---|---|---|
| FE-S2-01 | Build the upload tray | Drag-and-drop area, per-file progress to 100 percent, and per-file outcome rendering from the batch response. Client-side pre-checks for count and type that mirror the server rules without replacing them. Render the batch summary line on a mixed result and the duplicate link on a duplicate refusal. | AC-01.01, AC-01.03, AC-01.04, AC-01.05, AC-01.06, AC-03.01, AC-03.02 | FE1 | 3 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.2 |
| FE-S2-02 | Build the storage capacity indicator | Progress bar with the percentage, colour driven by the server's `level` rather than a client threshold, and the warning banner at 80 percent. Refetch after an upload settles. | AC-35.01, AC-35.02 | FE1 | 1 | [api-specs/04-configuration.md](api-specs/04-configuration.md) 4.5 |
| FE-S2-03 | Build the dashboard card grid | Visual cards carrying the file-type icon, title, upload date, uploader name and processing status. Empty state rendering the server's message when the tenant has no documents. | AC-38.01, AC-38.03, AC-01.02 | FE1 | 2 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.1, 5.4 |
| FE-S2-04 | Build the document detail shell and version picker | Detail route with the metadata, extracted-field and preview regions stubbed for later sprints. Version picker dropdown listing every version newest first and switching the active version. | AC-38.02, AC-21.02 | FE1 | 2 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.5, 5.6 |
| FE-S2-05 | Build the Configuration screen | Table with Parameter, Nilai, Satuan and Nilai Default columns rendered from the server's labels and units. Inline edit with the check icon, the reset-to-default control, and the two rejection messages rendered verbatim. Quota row read-only from `editable: false`. | AC-42.01, AC-42.02, AC-42.03, AC-42.04, AC-42.05 | FE1 | 2 | [api-specs/04-configuration.md](api-specs/04-configuration.md) 4.2 to 4.4 |
| FE-S2-06 | Add the new-version dialog | "Unggah Versi Baru" on the detail page: file picker, save, and the identical-content refusal rendered in place. On success the list still shows one row for the document. | AC-21.01, AC-21.03 | FE1 | 1 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.7 |
| FE-S2-07 | Wire upload end to end | Depends on BE-S2-01, BE-S2-02 and FE-S2-01; FE-S2-01 lands last, so frontend owns the wiring. Point the tray at the live endpoint, map every per-file error code to its message, and prove the hard cases against the running server: a 25 MB file refused, a duplicate refused with a working link, and a three-file batch where the quota runs out on the third and the summary line appears. Exit criterion is a Playwright flow using the qa seed fixtures. | AC-01.01, AC-01.06, AC-01.07, AC-01.08, AC-03.01, AC-03.04, AC-35.03, AC-35.04 | FE1 | 1.5 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.2; [01-conventions.md](api-specs/01-conventions.md) 1.6 |

---

## Sprint 3: Klasifikasi Otomatis dan Metadata

Stories: US-44, US-45, US-02, US-06, US-04, US-05, US-47  
Goal: an uploaded document processes itself, proposes a category a person confirms, carries its metadata and tags, and explains itself when it fails.

This is the critical-path sprint. The backend column is the constraint; if anything slips, it slips here.

### Backend

| Card ID | PM Card Title | Task Description | AC | Owner | Est | Docs |
|---|---|---|---|---|---|---|
| BE-S3-01 | Build the worker and the processing state machine | `apps/worker` consuming BullMQ. The four states and no others, with transitions guarded on the current state so a delayed duplicate job cannot move a READY document backwards. Three retries with exponential backoff on transient failures only, staying PROCESSING throughout so the user never sees a flicker. Idempotent `process`, every stage individually re-runnable. | AC-44.01, AC-44.02, AC-44.03 | BE1 | 3 | [technical-specs/12-document-processing-pipeline.md](technical-specs/12-document-processing-pipeline.md) 12.1 to 12.3 |
| BE-S3-02 | Extract text and paginate it | Native extraction for PDF, DOCX and XLSX, hosted OCR behind the `TextExtractor` port with a Tesseract adapter for on-premises. One `document_pages` row per page, the unit search will index. Permanent failures skip retry entirely: a password-protected PDF and unreadable content go straight to FAILED with their reasons. Partial OCR per page: some pages readable means READY with partial text. | AC-44.04, AC-44.05 | BE1 | 2.5 | [technical-specs/12-document-processing-pipeline.md](technical-specs/12-document-processing-pipeline.md) 12.1; [06-data-model.md](technical-specs/06-data-model.md) 6.8, 6.10.1 |
| BE-S3-03 | Manage the category taxonomy | `GET`, `POST` and `PATCH /categories`. Category and its permission row created in one transaction with `download_active = false`, and no request field that could make it otherwise. Case-insensitive duplicate rejection. The reserved system row refuses rename. | AC-45.01, AC-45.02 | BE1 | 1.5 | [api-specs/06-categories.md](api-specs/06-categories.md) 6.2 to 6.4 |
| BE-S3-04 | Classify documents with the AI provider | Claude behind the `AiProvider` port with pinned model ids and a versioned prompt template. Document text passed as data in a structured prompt, response parsed against a Zod schema. A suggested category outside the tenant's taxonomy is rejected, never created; the document falls to the reserved `Uncategorized` row. Document type recognised and stored. | AC-06.01, AC-06.02, AC-06.03 | BE1 | 2.5 | [technical-specs/04-tech-stack.md](technical-specs/04-tech-stack.md) 4.5; [10-integration-points.md](technical-specs/10-integration-points.md) 10.6; [07-security.md](technical-specs/07-security.md) 7.8 |
| BE-S3-05 | Implement confirmation and the visibility window | `PUT /documents/:id/classification` recording the confirming actor and retaining the AI suggestion forever. The window predicate applied identically to list, detail, search and related, with no stored state and no sweeper: uploader-only while unconfirmed and young, tenant-wide once confirmed or aged, bypassed from Head of Team up. `GET /documents/unconfirmed` as its own guarded route. | AC-02.01, AC-02.02, AC-02.03, AC-02.04, AC-02.05, AC-02.06, AC-02.07, AC-45.03 | BE1 | 2.5 | [api-specs/06-categories.md](api-specs/06-categories.md) 6.6 to 6.8; [api-specs/05-documents.md](api-specs/05-documents.md) 5.4.1 |
| BE-S3-06 | Extract metadata and generate tags | Author and document creation date from the file, both nullable, with null sent as null rather than a placeholder string. At most three tags kept, chosen by descending confidence and truncated at write time rather than read time. Top Tags aggregation cached in Valkey. | AC-04.01, AC-04.02, AC-05.01, AC-05.05 | BE1 | 1.5 | [api-specs/07-enrichment.md](api-specs/07-enrichment.md) 7.3, 7.7 |
| BE-S3-07 | Accept corrections to AI output | `PATCH /documents/:id/fields` and `PUT /documents/:id/tags`. Ownership condition with the Head of Team bypass. Every change writes an override row retaining the original AI value permanently, plus an audit event. A no-op change writes nothing, so the accuracy metric is not inflated by non-events. Tag replacement preserves the AI source flag on surviving tags. | AC-47.01, AC-47.02, AC-47.03, AC-47.04 | BE1 | 2 | [api-specs/07-enrichment.md](api-specs/07-enrichment.md) 7.4, 7.5 |
| BE-S3-08 | Prove the pipeline against the UI | Depends on BE-S3-01, BE-S3-02, BE-S3-04 and FE-S3-01; BE-S3-04 lands last, so backend owns the wiring. Drive real fixtures through the composed stack and assert the states the user actually sees: a clean PDF reaching Siap, a transient AI failure staying Diproses across retries, a password-protected file at Gagal with its reason and still downloadable, and the reporting fixture arriving with the right suggested category. Exit criterion is a Playwright flow against the qa seed. | AC-44.01, AC-44.02, AC-44.03, AC-44.04, AC-44.05, AC-06.01 | BE1 | 1.5 | [technical-specs/12-document-processing-pipeline.md](technical-specs/12-document-processing-pipeline.md) 12.2; [api-specs/07-enrichment.md](api-specs/07-enrichment.md) 7.2 |

### Frontend

| Card ID | PM Card Title | Task Description | AC | Owner | Est | Docs |
|---|---|---|---|---|---|---|
| FE-S3-01 | Show processing status on documents | The four Indonesian status labels rendered from the server rather than a client map. Poll the processing endpoint while a document is Antre or Diproses and stop on Siap or Gagal. Failure reason shown alongside the Gagal state, with the document still openable and still downloadable. | AC-44.01, AC-44.03, AC-44.04, AC-44.05 | FE1 | 2 | [api-specs/07-enrichment.md](api-specs/07-enrichment.md) 7.2 |
| FE-S3-02 | Build the Permission Category screen | Category table with the download-permission column, and the add-category dialog. New rows render as Inactive. Duplicate-name refusal shown in the dialog without losing the typed value. | AC-45.01, AC-45.02 | FE1 | 1.5 | [api-specs/06-categories.md](api-specs/06-categories.md) 6.2, 6.3 |
| FE-S3-03 | Build the category confirmation flow | The "Saran" marker on an unconfirmed document, the category picker with the suggestion preselected, and the Konfirmasi action. On success the marker clears and the document leaves the UPLOADED DOCUMENT tray. Send the category id explicitly even when accepting the suggestion. | AC-02.01, AC-02.02, AC-02.03, AC-02.04 | FE1 | 2 | [api-specs/06-categories.md](api-specs/06-categories.md) 6.6, 6.7 |
| FE-S3-04 | Build the Uncategorized review queue | Head of Team queue listing unconfirmed and uncategorized documents with uploader and upload date, oldest first. Filing a document from the queue uses the same confirmation call as the member flow. | AC-45.03, AC-02.07, AC-06.03 | FE1 | 1.5 | [api-specs/06-categories.md](api-specs/06-categories.md) 6.8 |
| FE-S3-05 | Build the metadata panel | Author and extracted creation date on the detail page, rendering "Tidak diketahui" when the server sends null. Document type label shown on the card and the detail page. | AC-04.01, AC-04.02, AC-06.02 | FE1 | 1 | [api-specs/07-enrichment.md](api-specs/07-enrichment.md) 7.3 |
| FE-S3-06 | Build the Top Tags panel and tag filter | Ten tags ordered by document count descending, at most three tags per document card. Click to filter, click again to add a second tag, with conjunctive semantics and highlighted chips. Filter state in the URL via TanStack Router search params. Empty-combination message from the server. | AC-05.01, AC-05.02, AC-05.03, AC-05.04 | FE1 | 2 | [api-specs/07-enrichment.md](api-specs/07-enrichment.md) 7.7; [api-specs/05-documents.md](api-specs/05-documents.md) 5.4 |
| FE-S3-07 | Add inline correction of AI output | Click-to-edit on extracted fields and the document type, and tag add and remove on the detail page. Refresh the Top Tags panel after a tag edit. Render the ownership refusal when a member opens someone else's document. | AC-47.01, AC-47.02, AC-47.03 | FE1 | 2 | [api-specs/07-enrichment.md](api-specs/07-enrichment.md) 7.4, 7.5 |
| FE-S3-08 | Wire confirmation and the visibility window end to end | Depends on BE-S3-05 and FE-S3-03; FE-S3-03 lands last, so frontend owns the wiring. Prove the window with two member accounts against the running server: a colleague's fresh unconfirmed document is absent and shows the not-found message, the same document past the window appears as Uncategorized, and a Head of Team sees it immediately. Then confirm and override, asserting the tray empties and the original suggestion is retained. Exit criterion is a Playwright flow with a seeded aged document. | AC-02.03, AC-02.04, AC-02.05, AC-02.06, AC-02.07 | FE1 | 1.5 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.4.1; [api-specs/06-categories.md](api-specs/06-categories.md) 6.6 |

---

## Sprint 4: Pencarian dan Penemuan Dokumen

Stories: US-07, US-33, US-34, US-37, US-39, US-08, US-09  
Goal: a phrase inside a file finds the page it is on, in under three seconds, and the document opens on that page.

### Backend

| Card ID | PM Card Title | Task Description | AC | Owner | Est | Docs |
|---|---|---|---|---|---|---|
| BE-S4-01 | Build the search index and the index stage | OpenSearch index with one document per page, the ICU plus dual-stemmer analyzer chain and no stopword removal. Index document id of `versionId:pageNumber` so re-indexing overwrites rather than duplicates and the index stage can retry safely. Title denormalised onto every page document. Index stage wired into the pipeline. | AC-07.01 | BE1 | 2.5 | [technical-specs/13-search-indexing-strategy.md](technical-specs/13-search-indexing-strategy.md) 13.1, 13.2 |
| BE-S4-02 | Serve title and metadata search | `GET /search/titles` with the two-character guard that refuses before touching OpenSearch, deduplication to one hit per document, the window predicate applied to hits, and the distinct empty-state messages. Write the `search.performed` event carrying the result count. | AC-07.01, AC-07.02, AC-07.03 | BE1 | 1.5 | [api-specs/08-search.md](api-specs/08-search.md) 8.2 |
| BE-S4-03 | Serve deep content search | `GET /search/content` returning the page number and a highlighted fragment per hit, collapsed to the best page per document with a match count. Quoted queries treated as exact phrases against the keyword sub-field so hyphenated terms survive. In-flight notice when any document in the tenant is not READY. | AC-33.01, AC-33.03 | BE1 | 2 | [api-specs/08-search.md](api-specs/08-search.md) 8.3 |
| BE-S4-04 | Serve related documents | `GET /documents/:id/related` as a tenant-filtered `more_like_this` over tags and category, capped at five and not configurable upward, excluding the document itself and applying the window predicate. Each hit explains why it matched. | AC-08.01, AC-08.02 | BE1 | 1 | [api-specs/08-search.md](api-specs/08-search.md) 8.4 |
| BE-S4-05 | Add category and tag filtering with pagination | Category filter, conjunctive tag filter, and the pagination contract with truthful totals and the per-filter empty-state messages. A page past the last returns an empty array with honest meta rather than a 404. | AC-34.01, AC-34.02, AC-34.03, AC-39.01, AC-39.02, AC-39.03 | BE1 | 1.5 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.4; [01-conventions.md](api-specs/01-conventions.md) 1.5 |
| BE-S4-06 | Serve document previews | `GET /documents/:id/preview` streaming PDFs directly and converting DOCX, XLSX and TXT through Gotenberg. Preview deliberately not gated by the download permission, since the disabled Download button is rendered on the preview page. Unavailable preview typed rather than a generic failure, with the Download control still usable. Write the preview audit event. | AC-09.01, AC-09.02, AC-09.03 | BE1 | 2 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.8 |
| BE-S4-07 | Prove search tenant isolation | Depends on BE-S4-01, BE-S4-02 and BE-S4-04; BE-S4-04 lands last, so backend owns the wiring. AC-43.02 is a Sprint 1 criterion that could not be proven until an index existed, so it is closed here. Seed two tenants with colliding content, then assert that a title search, a content search and the related panel each return nothing from the other tenant, and that the caller cannot supply a query body. Exit criterion is the integration suite green in CI. | AC-43.02, AC-08.04 | BE1 | 1 | [technical-specs/13-search-indexing-strategy.md](technical-specs/13-search-indexing-strategy.md) 13.1; [api-specs/08-search.md](api-specs/08-search.md) 8.1 |

### Frontend

| Card ID | PM Card Title | Task Description | AC | Owner | Est | Docs |
|---|---|---|---|---|---|---|
| FE-S4-01 | Build the search bar and title results | Search input with Enter to submit, result rows showing filename and matched snippet with the emphasis markup rendered safely. Short-query and no-result messages from the server. | AC-07.01, AC-07.02, AC-07.03 | FE1 | 2 | [api-specs/08-search.md](api-specs/08-search.md) 8.2 |
| FE-S4-02 | Build the content search results view | Result rows carrying the page number and the highlighted fragment. Render the in-flight notice above results rather than in place of them. | AC-33.01, AC-33.03 | FE1 | 2 | [api-specs/08-search.md](api-specs/08-search.md) 8.3 |
| FE-S4-03 | Build the document viewer | `pdf.js` via `react-pdf` rendering every page with no local download. Converted output for Office formats. Jump to the page a search result names and highlight the term in yellow. Unavailable-preview message with the Download control still active. | AC-09.01, AC-09.02, AC-09.03, AC-33.02 | FE1 | 2.5 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.8; [technical-specs/04-tech-stack.md](technical-specs/04-tech-stack.md) 4.3 |
| FE-S4-04 | Build the category filter control | Single-category filter with a show-all option, state in the URL, and the empty-category message from the server. | AC-34.01, AC-34.02, AC-34.03 | FE1 | 1 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.4 |
| FE-S4-05 | Add local table filtering | TanStack Table keyword filter over the loaded page for the document list, and the no-match message. The Audit Trail filter uses the server-side query parameter instead so it still works past page one. | AC-37.01, AC-37.03 | FE1 | 1 | [api-specs/01-conventions.md](api-specs/01-conventions.md) 1.14 |
| FE-S4-06 | Build the pagination component | Range-and-total line, previous and next controls, numbered pages with the active page highlighted, all composed from the response meta. Controls hidden when everything fits on one page. | AC-39.01, AC-39.02, AC-39.03 | FE1 | 1 | [api-specs/01-conventions.md](api-specs/01-conventions.md) 1.5 |
| FE-S4-07 | Build the Dokumen Terkait section | Up to five related documents on the detail page showing filename and uploader, navigating to that document's detail on click, with the empty message from the server. | AC-08.01, AC-08.02, AC-08.03 | FE1 | 1 | [api-specs/08-search.md](api-specs/08-search.md) 8.4 |
| FE-S4-08 | Wire deep search to the viewer | Depends on BE-S4-03, FE-S4-02 and FE-S4-03; FE-S4-03 lands last, so frontend owns the wiring. Prove the headline criterion against the running server with the seeded contract fixture: search the hyphenated phrase, get the page 15 hit with its highlighted snippet, click through, and land on page 15 with the term highlighted. Assert the response budget against a loaded index. Exit criterion is a Playwright flow. | AC-33.01, AC-33.02, AC-07.01 | FE1 | 1.5 | [api-specs/08-search.md](api-specs/08-search.md) 8.3; [technical-specs/08-nfr.md](technical-specs/08-nfr.md) 8.2 |

---

## Sprint 5: Tata Kelola, Unduhan, dan Pemantauan

Stories: US-10, US-11, US-14, US-13, US-12, US-36  
Goal: downloads are governed by the taxonomy, every attempt and refusal is on the record, and the numbers behind adoption are visible.

### Backend

| Card ID | PM Card Title | Task Description | AC | Owner | Est | Docs |
|---|---|---|---|---|---|---|
| BE-S5-01 | Serve governed single downloads | `POST /documents/:id/download` streaming through the API rather than a pre-signed URL, because the object store can neither consult a category permission nor write to the ledger. Permission read from current state with no cache. Audit written on both outcomes. Idempotency key deduplicating a double click to one file and one audit row. | AC-10.01, AC-10.03, AC-10.04, AC-43.04 | BE1 | 2 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.9; [technical-specs/07-security.md](technical-specs/07-security.md) 7.5 |
| BE-S5-02 | Serve bulk downloads | `POST /documents/download-bulk` returning a short-lived ticket carrying the omission list and its message, then `GET` streaming the zip. Restricted documents omitted rather than failing the request. Fifty-document cap refusing before any archive is built. One audit row per document on both outcomes. | AC-11.01, AC-11.02, AC-11.03 | BE1 | 2 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.10, 5.11 |
| BE-S5-03 | Serve the download permission toggle | `PUT /categories/:id/download-permission` taking the desired state rather than a flip instruction, so concurrent toggles converge. Audit row on every call including a no-change call. Effective on the very next request, which is what the database-backed session and the uncached predicate together buy. | AC-14.01, AC-14.02, AC-14.03 | BE1 | 1 | [api-specs/06-categories.md](api-specs/06-categories.md) 6.5 |
| BE-S5-04 | Serve the audit trail | `GET /audit-events` with filters on action, outcome, actor, subject and date, plus the server-side keyword filter. Outcome-aware Indonesian action labels served rather than mapped in the client. Rows survive their subjects. Empty-state message for a tenant with no activity. | AC-13.01, AC-13.02, AC-13.03, AC-37.02 | BE1 | 2 | [api-specs/09-activity.md](api-specs/09-activity.md) 9.1, 9.2 |
| BE-S5-05 | Serve the analytics dashboard | Nightly and on-demand rollups, with the dashboard reading rollups rather than raw events so it stays fast as the ledger grows. Volume, retrieval and AI-quality metrics over their fixed windows, with the sample size behind the override rates. A tenant with no data returns real zeros and the empty message, never nulls. | AC-12.01, AC-12.02, AC-12.03, AC-12.04 | BE1 | 2.5 | [api-specs/09-activity.md](api-specs/09-activity.md) 9.3 |

### Frontend

| Card ID | PM Card Title | Task Description | AC | Owner | Est | Docs |
|---|---|---|---|---|---|---|
| FE-S5-01 | Add the download control | Download button on the preview and detail pages, disabled with the warning message when the category is not downloadable, driven by the server's flag. Suppress the client-side double submit while still sending the idempotency key. | AC-10.01, AC-10.02, AC-10.04 | FE1 | 1.5 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.9 |
| FE-S5-02 | Add bulk selection and download | Checkbox selection on the document list, the Download Selected action, the two-step ticket then archive fetch, and the server's partial-omission message rendered before the file arrives. Over-cap refusal shown without building anything. | AC-11.01, AC-11.02, AC-11.03 | FE1 | 2 | [api-specs/05-documents.md](api-specs/05-documents.md) 5.10, 5.11 |
| FE-S5-03 | Add the permission toggle to the category screen | Toggle switch on each category row sending the desired state, with optimistic update rolled back on failure and the refusal rendered when a member reaches the control. | AC-14.01, AC-14.02 | FE1 | 1 | [api-specs/06-categories.md](api-specs/06-categories.md) 6.5 |
| FE-S5-04 | Build the Audit Trail screen | Table with the Siapa, Apa, Aksi and Kapan columns, rendering the server's action labels. Filter box bound to the server-side keyword parameter. Empty-state message for a tenant with no activity. | AC-13.01, AC-13.02, AC-13.03, AC-37.02 | FE1 | 2 | [api-specs/09-activity.md](api-specs/09-activity.md) 9.2 |
| FE-S5-05 | Build the Analitik dashboard | Metric cards for volume, retrieval and AI quality over their stated windows. Zeros render as cards, not as blanks, alongside the empty message for a new tenant. | AC-12.01, AC-12.02, AC-12.03, AC-12.04 | FE1 | 2 | [api-specs/09-activity.md](api-specs/09-activity.md) 9.3 |
| FE-S5-06 | Add the theme toggle | Dark and light mode through the shadcn theme layer with a class toggle, button label swapping between the two, applied across every page. Preference persisted in `localStorage` and restored on load; there is no server-side preference and no endpoint. | AC-36.01, AC-36.02 | FE1 | 1 | [api-specs/01-conventions.md](api-specs/01-conventions.md) 1.14; [technical-specs/04-tech-stack.md](technical-specs/04-tech-stack.md) 4.3 |
| FE-S5-07 | Wire governance to refusal end to end | Depends on BE-S5-01, BE-S5-03 and FE-S5-03; FE-S5-03 lands last, so frontend owns the wiring. Prove the governance loop against the running server in one pass: download succeeds while the category is Active, a Head of Team flips it to Inactive, the very next download attempt is refused with the warning, a direct endpoint call is also refused, and both the allowed and denied rows appear in the Audit Trail with the right labels. Exit criterion is a Playwright flow covering all six criteria. | AC-14.01, AC-14.02, AC-14.03, AC-10.02, AC-10.03, AC-13.02 | FE1 | 1.5 | [api-specs/06-categories.md](api-specs/06-categories.md) 6.5; [api-specs/05-documents.md](api-specs/05-documents.md) 5.9; [api-specs/09-activity.md](api-specs/09-activity.md) 9.2 |

---

## Definition of Done (per card)

A card is done when every one of these holds. Not when the code is written.

1. **Every cited AC passes against a running server.** Not against a mock, not against a unit test that stubs the boundary. If the card cites an AC, that criterion is demonstrated end to end on the composed stack.
2. **Indonesian strings match the criterion verbatim.** No translation, no paraphrase, and no test asserting on an English approximation.
3. **The server refuses what the UI hides.** Any permission the card touches is asserted by a test that calls the endpoint directly and expects the refusal status, never by asserting a button is disabled.
4. **Tenant scope is proven, not assumed.** Any card touching tenant-owned data carries a test attempting access with a valid id from another tenant and expecting 404.
5. **The audit row exists where a criterion names one**, including on the denied path.
6. **Typecheck, lint, unit and integration suites pass in CI.** Database tests run against real PostgreSQL through Testcontainers with real migrations applied.
7. **The api-specs operation status tracker is updated** from TODO to OK for every operation the card completes, so [api-specs/_index.md](api-specs/_index.md) stays honest.
8. **No rule is restated.** If the card needed a pipeline or search rule, it cites the ad-hoc spec rather than copying it.

---

## Summary

| Sprint | Focus | TL cards | BE cards | FE cards | TL Est | BE Est | FE Est |
|---|---|---|---|---|---|---|---|
| 0 | Fondasi Teknis | 8 | 0 | 0 | 14.5 | 0 | 0 |
| 1 | Fondasi Tenant dan Akses Pengguna | 0 | 5 | 5 | 0 | 10.5 | 8 |
| 2 | Unggah, Simpan, dan Batas Penyimpanan | 0 | 8 | 7 | 0 | 14.5 | 12.5 |
| 3 | Klasifikasi Otomatis dan Metadata | 0 | 8 | 8 | 0 | 17 | 13.5 |
| 4 | Pencarian dan Penemuan Dokumen | 0 | 7 | 8 | 0 | 11.5 | 12 |
| 5 | Tata Kelola, Unduhan, dan Pemantauan | 0 | 5 | 7 | 0 | 9.5 | 11 |
| **Total** | | **8** | **33** | **35** | **14.5** | **63** | **57** |

