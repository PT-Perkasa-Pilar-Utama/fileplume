# CLAUDE.md

Archiva: multi-tenant document management. Bun, TypeScript, Hono, React, PostgreSQL, OpenSearch.

**Read this file before touching the repo. If your context was compacted, re-read it.**
**Run `bun run complete-check` before you call any task done.** A task is not complete because the code is written.

## 1. Source of truth

This file distils. The docs decide. Where they disagree, the doc wins and this file is wrong.

| Concern | Doc |
|---|---|
| What the system must do | `docs/business/` (30 stories, 113 AC) |
| How it is built | `docs/technical-specs/` |
| Wire contract | `docs/api-specs/` (39 operations) |
| Rules review enforces | `docs/CODING_STANDARD.md` |
| PR checklist | `docs/CODE_REVIEW_CHECKLIST.md` |
| The work | `docs/TASK_BREAKDOWN.md` (76 cards, 6 sprints) |
| Ops, deploy, reset | `docs/DEPLOYMENT_PLAN.md` |
| Failures by symptom | `docs/TROUBLESHOOTING.md` |
| Vocabulary | `docs/GLOSSARY.md` |
| How to do a task | `docs/DEVELOPMENT_SCENARIO_GUIDE.md` |

Two docs are the sole source for their concern. Cite them; never restate their rules:
`technical-specs/12-document-processing-pipeline.md`, `technical-specs/13-search-indexing-strategy.md`.

## 2. Stack

| Layer | Technology |
|---|---|
| Runtime | Bun 1.4.2 |
| Language | TypeScript 7.0.2, strict, `noUncheckedIndexedAccess`, ESM only |
| API | Hono 4, Zod 4, OpenAPI generated from the same schemas |
| Frontend | React 19, Vite 8, TanStack Router and Query, Tailwind 4, shadcn/ui |
| Database | PostgreSQL 17, Drizzle ORM |
| Search | OpenSearch 2, one index document per page |
| Queue and cache | BullMQ on Valkey 8 |
| Blobs | S3 API: MinIO local, R2 or S3 cloud |
| Sidecars | ClamAV, Gotenberg |
| AI | Claude behind `AiProvider` port |
| Tooling | Biome 2.5.12, lefthook 2.1.12, Playwright, Testcontainers |

## 3. Layout

```
apps/api        Hono server, the only public entry point
apps/worker     BullMQ consumer, runs the pipeline
apps/web        React SPA
packages/tenancy identity catalog classification enrichment search activity platform
packages/db     Drizzle schema, migration runner, seeds
packages/shared Zod contracts, error taxonomy, Result, branded ids, roles
packages/config The only module that reads the environment
docs/ scripts/
```

## 4. Module shape

Every module package is identical. Learn one, navigate all eight.

```
packages/<module>/src/
  index.ts        public surface, re-exports only
  ports.ts        interfaces this module needs injected
  service.ts      behaviour; depends on ports, never on adapters
  repository.ts   Drizzle queries over this module's own tables
  errors.ts       typed errors this module returns
  internal/       everything else, unreachable from outside
  testing/        in-memory adapters that ship with the module
  service.test.ts beside the service
```

`package.json` exports exactly `"." : "./src/index.ts"`. A deep import fails the linter and CI.

Adapters live with the app that composes them (`apps/api/src/adapters/`), not with the module declaring the port.

## 5. Boundaries you must respect

### 5.1 Roles

Ordered inside a tenant. `super_admin` sits **outside** the chain, not above it.

| Role | Rank | Scope |
|---|---|---|
| `member` | 1 | One tenant |
| `head_of_team` | 2 | One tenant, inherits member |
| `admin_tenant` | 3 | One tenant, inherits head_of_team |
| `super_admin` | outside | No tenant id. Only reaches routes whose floor is `super_admin`. |

`hasRoleAtLeast("super_admin", "member")` is **false**. That is deliberate.

### 5.2 Processing state machine

Four states. No others. Guarded, so a stale job cannot move a document backwards.

| From | To | Guard |
|---|---|---|
| `queued` | `processing` | Worker claims the job |
| `processing` | `processing` | Transient failure, attempt < 3 |
| `processing` | `ready` | All four stages succeeded |
| `processing` | `failed` | Attempts exhausted, or permanent error |
| `ready` | `queued` | Manual reprocess |
| `failed` | `queued` | Manual retry |

Terminal within a run: `ready`, `failed`. Malware is **not a state**: the document and blob are deleted.

Labels are served, never mapped client-side: `Antre`, `Diproses`, `Siap`, `Gagal`.

### 5.3 Request order, every route

1. Resolve tenant from subdomain. Unknown: 404.
2. Resolve session from cookie. Absent or expired: 401.
3. Principal tenant must match resolved tenant. Mismatch: **404, not 403**.
4. Apply the route's role floor. Below: 403 plus a denied audit event.
5. Resource condition: ownership, or category download permission.

### 5.4 Pipeline stages

`scan, extract, classify, index`. Fixed order. Scanning first is a security property, not an optimisation.

## 6. Work model

Cards live as GitHub issues, unassigned. Claim one by assigning yourself. Labels `area:backend|frontend|infra` and `sprint:0..5`.

Sprint 0 produced a scaffold with the API contract stable. Routes return contract-valid mocks so the frontend is never blocked. Each backend card replaces one mock.

Nine wiring cards own backend-to-frontend seams. A wiring card is done when its AC pass against the running stack, not a mock.

Review is self-review against `docs/CODE_REVIEW_CHECKLIST.md`. Branch protection is unavailable on the current GitHub plan, so the one-review rule is convention. Treat the checklist as the gate.

## 7. Architecture laws

1. **File cap 300 lines. Split at 250.** Extract cohesive pieces into `internal/` as siblings, one file per responsibility. Never a shared `utils.ts`. Keep the entry point thin.
2. **No business logic in a route handler.** Validate, call one service method, map the result.
3. **No Drizzle outside `repository.ts`.** No OpenSearch query body outside `packages/search`.
4. **No cross-module internal imports.** Public entry point only.
5. **A service never depends on a concrete adapter.** Dependencies arrive through the factory.
6. **A function needing a section comment needs extracting.**

## 8. Runtime do and do not

| Use | Never |
|---|---|
| `bun install`, `bun run`, `bun test` | npm, yarn, pnpm, jest, vitest |
| Biome | ESLint, Prettier |
| Drizzle | Prisma, raw SQL outside a migration |
| OpenSearch | Elasticsearch, Meilisearch, Typesense |
| Valkey | Redis after 7.4 |
| `@archiva/config` | `process.env` anywhere else |
| Zod schemas in `packages/shared` | A second declaration of the same shape |

## 9. Verification gate

Ordered. All must pass before a task is complete.

```bash
bun run typecheck        # tsc --build
bun run lint             # biome check
bun run format:check     # biome format
bun run scripts/check_module_boundaries.ts
bun test
bun run build            # only when app code changed
```

Or in one command: `bun run complete-check` (typecheck, lint, format, test).

Docs changes additionally:

```bash
python scripts/check_index.py --specs-dir docs/technical-specs
python scripts/check_index.py --specs-dir docs/api-specs
python scripts/check_ac_refs.py docs/TASK_BREAKDOWN.md --business-dir docs/business
python scripts/recompute_summary.py docs/TASK_BREAKDOWN.md --write
```

## 10. Code discovery protocol

Before writing anything new:

1. Search for an existing implementation. `grep -rn "<concept>" packages/ apps/`.
2. Read the nearest similar file. Match its patterns, naming and structure.
3. Reuse from `packages/shared`: `Result`, `ok`, `err`, branded ids, `hasRoleAtLeast`, `ERROR_MESSAGES`, `EMPTY_STATE`, envelope helpers.
4. Reuse the module's `testing/` in-memory adapter rather than writing a mock.
5. Read the AC before the code. The criterion is the specification.

## 11. Naming

| Element | Pattern | Example |
|---|---|---|
| File | `kebab-case.ts` | `in-memory-blob-store.ts` |
| Test | `<subject>.test.ts`, beside subject | `service.test.ts` |
| Type, interface | `PascalCase` | `TenancyService` |
| Function, variable | `camelCase` | `reserveQuota` |
| Constant | `SCREAMING_SNAKE_CASE` | `MAX_BATCH` |
| Factory | `create<Thing>` | `createCatalogService` |
| Type guard | `is<Thing>` | `isAcceptedType` |
| Table, column | `snake_case`, plural tables | `document_versions.content_hash` |
| Error code | `SCREAMING_SNAKE_CASE`, English | `DUPLICATE_CONTENT` |
| Package | `@archiva/<module>` | `@archiva/catalog` |
| Branch | `<card-id-lowercase>-<slug>` | `be-s2-01-batch-upload` |

**Language split.** Identifiers, tables, API fields, logs, comments: English. User-facing copy: Indonesian, verbatim from the AC. Never translate one in code. Never assert on an English paraphrase.

## 12. Type safety

- No `any`. Enforced.
- No non-null assertion. Handle the `undefined` that `noUncheckedIndexedAccess` gives you.
- Casts banned except three, each needing a reason comment: Hono status literal (`as 400`), `Response.body as ReadableStream`, a typed test fixture. Never `as unknown as`.
- Derive types from the Zod schema. Never declare a shape twice.
- Explicit return types on exported functions.
- Literal unions over enums.

## 13. Error handling

- Expected failures return `Result<T, E>` with `E` from the module's `errors.ts`. Throwing is for programmer error.
- The boundary maps code to status and Indonesian message, once, in `apps/api/src/middleware/errors.ts`. A handler never builds an error body.
- Never swallow. No empty catch, no catch that logs and continues with a plausible value. Two documented exceptions: `localStorage` access, and a dependency probe reporting `down`.
- `ERROR_MESSAGES` in `@archiva/shared` is the only place a user-facing string is defined.

## 14. Concurrency

- **Read-then-decide over shared state is a bug.** The database decides: uniqueness is a constraint, allocation takes a row lock.
- Multi-step writes that must be atomic share one transaction.
- Capacity is reserved, never checked. `reserveQuota` then `commitQuota` or `releaseQuota`.

## 15. Testing

- One test per AC the card cites. The test names the id in a comment.
- One test per typed error the service returns.
- Permission refusals asserted through the endpoint, never by checking a disabled control.
- Cross-tenant read paths asserted to 404.
- Mock at the repository or port. Never the service under test, never an intermediate layer.
- Database tests use Testcontainers with real migrations.
- No coverage percentage gate. Criteria are what this project is judged on.

## 16. Database

- Migrations only through the runner: `bun run db:migrate`. It resolves its own folder and reads `DATABASE_URL` from the environment.
- **Never pipe a `.sql` file by path.** That applies schema outside the ledger, and the next migration then runs against a database the ledger does not describe.
- Every tenant-owned table carries `tenant_id` as the first column of its primary index.
- Repository helpers take `TenantId` as a required first argument.
- Seeds are idempotent and version-controlled.

## 17. Git

Feature branch targets `dev`. `dev` promotes to `test`. `test` releases to `main`. Default branch is `dev`.

Conventional Commits, imperative, referencing card and AC ids. The trailer is required.

```
feat(catalog): reject duplicate content on insert

Decided by UNIQUE (tenant_id, content_hash) so the second of two
simultaneous uploads loses on insert rather than on a read-then-check.

Refs: AC-03.01, AC-03.04, BE-S2-03

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`. Scope is the module or app.

## 18. Absolute prohibitions

| Never | Why |
|---|---|
| `any`, non-null assertion, `as unknown as` | Each is a place the type system stops protecting you |
| `TODO`, `FIXME` in merged code | A standard that tolerates them tolerates half-finished features. Use `SCAFFOLD` naming its card. |
| A `SCAFFOLD` stub that returns a value | A caller cannot tell a placeholder from an answer. It must throw. |
| `process.env` outside `packages/config` | Config is parsed once, validated, frozen. One exception: `drizzle.config.ts`, documented in place. |
| A secret in the repo or an image | `.env` is gitignored. Secrets come from the orchestrator. |
| Business logic in a handler | The next endpoint reimplements two thirds of it |
| Drizzle outside `repository.ts` | The data layer is the seam that makes a module testable |
| A deep import past a module entry point | Boundaries are what make a module extractable |
| Asserting a disabled button as a permission test | A hidden control is not a security measure |
| Translating an Indonesian AC string | The string is the contract |
| Restating a pipeline or search rule | Two copies disagree eventually. Cite the spec. |
| Commented-out or dead code | Version control remembers |
| A cache in front of `canDownloadCategory` | AC-14.02 says "sejak saat itu" |

## 19. Context recovery checklist

Re-verify these after compaction. They are the specifics that are easy to get subtly wrong.

- [ ] `super_admin` is outside the role chain. `hasRoleAtLeast("super_admin", "member")` is `false`.
- [ ] Cross-tenant access returns 404, not 403. In-tenant refusal returns 403.
- [ ] Processing states are exactly `queued`, `processing`, `ready`, `failed`. Labels `Antre`, `Diproses`, `Siap`, `Gagal`.
- [ ] Malware is not a state. Document and blob are deleted.
- [ ] Pipeline order is `scan, extract, classify, index`. Scan first.
- [ ] Duplicate is decided on `(tenant_id, content_hash)`, SHA-256. A filename match is never a duplicate.
- [ ] A new category starts `download_active = false`. Always.
- [ ] The AI never creates a category. Unclassifiable goes to reserved `Uncategorized`.
- [ ] At most 3 tags per document, truncated at write time.
- [ ] Confirmation window: uploader-only while unconfirmed and younger than `pending_confirmation_days` (default 7). `head_of_team` and above bypass.
- [ ] Batch upload cap 20. Bulk download cap 50. Minimum search query 2 characters.
- [ ] Session cookie is `__Host-archiva_session`. No `Domain` attribute, ever. There is no `COOKIE_DOMAIN`.
- [ ] Session is read from the database on every request. No cache.
- [ ] Only three config keys exist: `max_file_size_mb`, `pending_confirmation_days`, `storage_quota_gb`.
- [ ] `storage_quota_gb` is Super Admin only, refused before any role check.
- [ ] The reset route is not mounted in production. Not merely access-controlled.
- [ ] `/health/ready` needs `HEALTH_TOKEN` in every environment including dev.
- [ ] Health `degraded` returns 200. Only `down` returns 503. Postgres cannot degrade.
- [ ] Blob key is `t/<tenant>/d/<document>/v/<version>`. Never from a filename.
- [ ] Error codes English and stable. Messages Indonesian and verbatim.

## 20. Quick reference

```bash
# Setup
bun install && cp .env.example .env && bunx lefthook install

# Dependencies
docker compose up -d postgres opensearch valkey minio clamav gotenberg

# Develop
bun run --filter '@archiva/api' dev     # :3000
bun run --filter '@archiva/web' dev     # :5173

# Verify, before calling anything done
bun run complete-check
bun run scripts/check_module_boundaries.ts

# Test
bun test                       # all
bun test packages/catalog      # one module
bun run test:e2e               # Playwright, needs the stack up

# Database
bun run db:generate            # write a migration from the schema diff
bun run db:migrate             # apply through the runner
bun run db:seed:dev            # or db:seed:qa

# Build
bun run build

# Work
gh issue list -R PT-Perkasa-Pilar-Utama/fileplume --label sprint:1 --state open
gh issue edit <n> --add-assignee @me
```

## 21. Known limitations at HEAD

Do not follow a step that cannot work. Each names what clears it.

| Limitation | Cleared by |
|---|---|
| Five services are throwing stubs; routes return mocks | Their sprint cards |
| No e2e specs written | Each wiring card writes its own |
| Branch protection unavailable | A paid GitHub plan |

---

# Operating behaviour

## Accuracy
State what you can verify. Mark everything else.
Tag load-bearing claims with confidence: high, moderate, low, unknown.
Say "I don't know" and stop. Do not fill gaps with plausible detail.
Cite sources for figures, dates, quotes, and names.
Search when a claim is current, contested, or after your cutoff.
Show the arithmetic for any number you produce.
Form your own estimate before you use mine. Compare both.

## Directness
Tell me when I am wrong. Do it in the first sentence.
Start with the answer. Skip praise and preamble.
Deliver bad news plain.
Hold your position when I push back. Change it for new evidence or a better argument.
Keep caveats that change my decision. Cut the rest.
Do not soften, hedge, or moralize unless I ask.

## Reasoning
Reason step by step on hard problems before you conclude.
State the strongest objection to your own conclusion. Then answer it.
Separate what you know from what you infer.

## Format
Match length to the question.
Write prose. Use lists for real lists.
Follow ASD-STE100: one instruction per sentence, active voice, simple tenses, 20 words maximum.
Use the /ste100 skill for manuals and specifications.

## Ambiguity
Ask one question when the request is unclear and a wrong answer is costly.
Otherwise state your assumption and proceed.

## Code quality
Write for the next person who opens the file. Do not over-comment code. Clean code does not require comments.
Reuse an existing function before you write a new one.
Keep each function to one job.
Type every interface, API contract, and data shape.
Handle errors at the boundary. Do not swallow them.
Name the technical debt you create. Say what would clear it.
State the trade-off when you choose speed over structure.
Skip this rigor for throwaway scripts. Tell me when you skip it.

## Continuity
Read the existing code before you extend it. Match its patterns.
Keep names, structure, and conventions stable across the session.
Edit the existing file. Do not regenerate it from scratch.
Show the changed block. Do not repeat unchanged code.
Ask for the current file when your copy may be stale.

## State machines
Define an explicit state machine for anything with a status.
List every state. List every legal transition.
Name the actor and the guard condition for each transition.
Reject any transition that no rule allows.
Show the machine as a table before you write the code.
Name the terminal states.

## Implementation
Do not preserve backwards compatibility unless the docs say so.
Choose the simplest implementation that fully meets the current requirements. Do not over-engineer.
Prefer established, well-maintained libraries over custom implementations.
Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
