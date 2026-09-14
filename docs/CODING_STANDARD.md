# Archiva Coding Standard

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Tech Lead  
**Status:** Approved  
**Phase:** Release 1  

Rules for this codebase, inferred from what it already does. `/code-review` enforces this document verbatim, so every rule here is either already followed at HEAD or was agreed explicitly before being written down.

Rules marked **(enforced)** are checked by a tool. A reviewer does not spend time on them by hand; if CI is green, they hold.

## 1. Project and verification

Bun workspace monorepo. TypeScript 7 strict, ESM only. Hono API, React SPA, BullMQ worker, PostgreSQL via Drizzle, OpenSearch, Valkey, S3. Eight domain modules under `packages/`, three deployables under `apps/`.

Architecture is fixed in [technical-specs/](technical-specs/). Endpoint contracts are fixed in [api-specs/](api-specs/). This document governs how the code that implements them is written.

### 1.1 Verification commands

```bash
bun run typecheck                        # tsc --build
bun run lint                             # biome check
bun run format:check                     # biome format
bun run scripts/check_module_boundaries.ts
bun test
bun run build
bun run complete-check                   # typecheck, lint, format, test
```

`complete-check` must pass before a PR is opened. CI runs all of the above plus the four Python document gates.

### 1.2 The two ad-hoc specs are single sources of truth

Pipeline rules live in `technical-specs/12-document-processing-pipeline.md`. Search rules live in `technical-specs/13-search-indexing-strategy.md`. Cite them. Never restate a rule from either in code comments or in another document.

## 2. Language and types

### 2.1 No `any` **(enforced)**

Biome `suspicious.noExplicitAny` is an error. The codebase has zero occurrences.

### 2.2 No non-null assertions

`noUncheckedIndexedAccess` is on, so an index access is `T | undefined` and must be handled. The codebase has zero `!` assertions.

```ts
// Wrong
const first = tags[0]!.tag;

// Right
const first = tags[0];
if (!first) return [];
```

### 2.3 Casts are banned outside three allowlisted cases

Every `as` outside the list below is a finding. Each allowlisted use carries a comment naming why the type system cannot express it.

| Allowed | Why |
|---|---|
| `err.status as 400` | Hono types the status parameter as a literal union; a computed number cannot satisfy it |
| `new Response(buf).body as ReadableStream` | The lib type is `ReadableStream \| null`, and a Response built from a buffer always has a body |
| `{ ...base } as Config` in a test fixture | Building the full frozen config shape by hand in every test is noise |

```ts
// Wrong
const user = raw as User;
const value = input as unknown as Target;   // never, under any circumstance

// Right
if (!isUser(raw)) return err({ kind: "NotFound" });
const user = raw;
```

### 2.4 Types are derived from the Zod schema, never declared twice

One schema is the runtime validator, the static type and the OpenAPI source.

```ts
// Right
const schema = z.object({ name: z.string() });
export type Config = z.infer<typeof schema>;
```

### 2.5 Prefer a literal union over an enum

```ts
// Right
export const ROLES = ["member", "head_of_team", "admin_tenant", "super_admin"] as const;
export type Role = (typeof ROLES)[number];
```

### 2.6 Exported functions carry an explicit return type

The inferred type of an exported function is part of the package's public surface. State it so a change to the body cannot silently change the contract.

## 3. Naming

| Thing | Pattern | Example |
|---|---|---|
| Files | `kebab-case.ts` | `in-memory-blob-store.ts` |
| Test files | `<subject>.test.ts`, beside the subject | `service.test.ts` |
| Types and interfaces | `PascalCase` | `TenancyService`, `ProbeResult` |
| Functions and variables | `camelCase` | `reserveQuota`, `isVisibleToViewer` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_BATCH`, `ERROR_MESSAGES` |
| Factory functions | `create<Thing>` | `createCatalogService` |
| Type guards | `is<Thing>` | `isAcceptedType`, `isQueryLongEnough` |
| Database tables and columns | `snake_case`, plural tables | `document_versions.content_hash` |
| Error codes | `SCREAMING_SNAKE_CASE`, English, stable | `DUPLICATE_CONTENT` |
| Workspace packages | `@archiva/<module>` | `@archiva/catalog` |

### 3.1 Code is English, user-facing copy is Indonesian

Identifiers, table names, API field names, log messages and comments are English. Interface copy, messages and errors shown to a user are Indonesian, quoted verbatim from the acceptance criterion. Never translate one in code, and never assert on an English paraphrase in a test.

```ts
// Right
QUOTA_EXCEEDED: "Kapasitas penyimpanan penuh",
```

## 4. Structure and layering

### 4.1 A module is imported only through its entry point **(enforced)**

`packages/<module>/package.json` exports exactly `"." : "./src/index.ts"`. Biome `noRestrictedImports` and `scripts/check_module_boundaries.ts` both fail on a deep import.

```ts
// Wrong
import { blobKey } from "@archiva/catalog/src/internal/blob-key.ts";

// Right
import { createCatalogService } from "@archiva/catalog";
```

### 4.2 Every module has the same six-part shape

```
packages/<module>/src/
  index.ts        the public surface, re-exports only
  ports.ts        interfaces this module needs injected
  service.ts      the behaviour, depends on ports never on adapters
  repository.ts   Drizzle queries over this module's own tables
  errors.ts       typed errors this module can return
  internal/       everything else, unreachable from outside
  testing/        in-memory adapters that ship with the module
  service.test.ts beside the service
```

A new file must be obvious to place. If it is not, it belongs in `internal/`.

### 4.3 Route handlers contain no business logic

A handler validates, calls one service method, and maps the result to the envelope. A rule that lives in a handler is a rule the next endpoint reimplements.

```ts
// Wrong
app.post("/documents", async (c) => {
  if (files.length > 20) return c.json({ error: "..." }, 422);
  const hash = await sha256(file);
  // ...
});

// Right
app.post("/documents", requireRole("member"), async (c) => {
  const result = await catalog.upload(input);
  return result.ok ? c.json(one(result.value), 201) : fail(c, toCode(result.error));
});
```

### 4.4 No data-store access outside a repository

Services depend on the repository interface. Drizzle appears in `repository.ts` and nowhere else. OpenSearch query bodies are constructed only inside `packages/search`.

### 4.5 Adapters live with the app that composes them

A module declares the port. `apps/api/src/adapters/` implements it for production. `packages/<module>/src/testing/` implements it for tests and ships with the module, so every module is importable in a test with no network, no container and no environment variables.

### 4.6 A service never depends on a concrete adapter

Dependencies arrive through a factory. There is no module-level singleton and no import of a live client inside `service.ts`.

```ts
// Right
export function createTenancyService(deps: { repository: TenancyRepository; clock: Clock }) { }
```

## 5. File and function size

### 5.1 Cap files at 300 lines, split at 250

The largest file at HEAD is 136 lines. When a file approaches the cap, extract cohesive pieces into `internal/` as siblings, one file per responsibility. Do not create a shared `utils.ts`; a file named for what it does is findable, a file named `utils` is a dumping ground.

### 5.2 A function that needs a section comment needs extracting

If a block inside a function has a comment describing what the next ten lines do, that block is a function.

## 6. Error handling

### 6.1 Expected failures return a typed Result, they do not throw

A service returns `Result<T, E>` where `E` is a union from that module's `errors.ts`. Throwing is for programmer error and unreachable states.

```ts
// Wrong
if (!spec.tenantEditable) throw new Error("not editable");

// Right
if (!spec.tenantEditable) return err({ kind: "NotEditableByTenant", key });
```

### 6.2 Errors map to the envelope at the boundary, once

`apps/api/src/middleware/errors.ts` owns the mapping from code to status and Indonesian message. A handler never builds an error body by hand.

### 6.3 Never swallow an error into a bare log

An empty catch, or a catch that logs and continues with a plausible-looking value, is a finding. The two permitted silent catches are documented in place: `localStorage` access, which throws in private windows, and a dependency probe, which reports `down` rather than propagating.

```ts
// Wrong
try { await audit.record(event); } catch (e) { console.log(e); }

// Right
try {
  await audit.record(event);
} catch (e) {
  // A failure to audit is alerted, but does not fail a download the user
  // was entitled to. packages/activity invariant 4.
  logger.error({ msg: "audit write failed", err: e });
  metrics.auditWriteFailed.inc();
}
```

### 6.4 Error codes are English and stable, messages are Indonesian

`ERROR_MESSAGES` in `@archiva/shared` is the only place a user-facing message string is defined.

## 7. Concurrency and atomicity

### 7.1 A read-then-decide over shared state is a bug

Where two requests can race, the database decides. Uniqueness is a constraint, not a lookup. Allocation takes a row lock.

```ts
// Wrong
const existing = await repo.findByContentHash(tenantId, hash);
if (existing) return err({ kind: "DuplicateContent" });
await repo.insert(...);          // AC-03.04 loses here

// Right
// UNIQUE (tenant_id, content_hash); the second writer loses on insert.
const inserted = await repo.tryInsert(...);
```

### 7.2 Multi-step writes that must be atomic share one transaction

A category and its permission row are created together, or not at all. Audit writes that a criterion requires share the transaction of the action they record.

### 7.3 Capacity is reserved, never checked

`reserveQuota` before the write, `commitQuota` after, `releaseQuota` on any failure. Reading usage and then deciding is the race AC-35.04 tests.

## 8. Security and tenancy

### 8.1 A hidden control is not a security measure

Every permission is enforced server-side and tested by asserting the refusal status against the endpoint. A test that asserts a button is disabled proves nothing.

### 8.2 Every route declares a role floor

`requireRole` takes a mandatory floor argument, so a route registered without one fails to compile. Floors, never sets: adding a role later must not require editing existing guards.

### 8.3 Tenant scope is a required argument, not a remembered `WHERE`

Repository helpers take `TenantId` first. A query that omits it does not typecheck.

### 8.4 Cross-tenant is 404, in-tenant refusal is 403

Inside the caller's tenant a refusal says the resource exists and they may not have it. Across tenants it must not confirm an id is real.

### 8.5 Every refusal writes a denied audit event

`outcome: "denied"` before the response is sent. AC-13.02, AC-14.03, AC-41.05 and AC-47.03 each assert the denial appears in the trail.

### 8.6 Blob keys come from ids, never from user input

`t/<tenant>/d/<document>/v/<version>`. A filename never reaches a path.

### 8.7 Operational routes are gated at registration, not by a check

The reset endpoint is not mounted in production. An authorization check is code that can be misconfigured; a route that exists is a route that can be reached. **(enforced)** by a CI test asserting 404 on a production-configured app.

## 9. Configuration and secrets

### 9.1 Application code reads config only through `packages/config`

Parsed once at startup with Zod into a frozen object. A missing or malformed value exits non-zero before the server binds. No default in code for any secret, and no silent fallback.

One exception, and only one: `packages/db/drizzle.config.ts`. drizzle-kit is a CLI that runs outside the application runtime and cannot call `loadConfig`, which validates the whole app schema and exits. It reads `DATABASE_URL` directly and fails loudly when it is absent. Any second exception is a finding.

```ts
// Wrong
const url = process.env.DATABASE_URL ?? "postgres://localhost/dev";

// Right
import { loadConfig } from "@archiva/config";
const config = loadConfig();
```

### 9.2 A new variable touches three places in one commit

The Zod schema, `.env.example`, and `technical-specs/11-environment-configuration.md`. Not yet tool-enforced; a reviewer checks this by hand.

### 9.3 No secret in the repository, no secret in an image

`.env.local` is gitignored. Secrets are injected by the orchestrator and redacted by the log serialiser.

## 10. Tests

### 10.1 What must have a test

- One case per acceptance criterion the card cites. A card citing AC-03.01 has a test asserting AC-03.01.
- One case per typed error the service can return.
- Every permission refusal, asserted through the endpoint.
- Every cross-tenant read path, asserted to 404.

There is no coverage percentage gate. Coverage rewards touching lines; this project is judged on criteria.

### 10.2 Mock at the deepest boundary

Substitute the repository or the port. Never mock the service under test, and never mock an intermediate layer to make an awkward test pass.

```ts
// Right
const repository = inMemoryTenancyRepository({ quotaBytes: 100 });
const service = createTenancyService({ repository, clock });
```

### 10.3 Arrange, act, assert, one assertion target per case

A test name states the behaviour, not the function. `"reserving counts against outstanding reservations"` beats `"reserveQuota works"`.

### 10.4 A test that names a criterion cites its id

```ts
test("a colleague does not see a fresh unconfirmed document", () => {
  // AC-02.05
});
```

### 10.5 Database tests run against real PostgreSQL

Testcontainers with real migrations applied. A mocked query proves the mock.

## 11. Deferred work

### 11.1 `SCAFFOLD` is the only permitted deferral marker

`TODO` and `FIXME` in merged code are findings. Every `SCAFFOLD` names the card that replaces it. A PR that leaves one lists it in its description.

It takes exactly two forms:

**A stub body throws.** It never returns a plausible-looking value, because a caller cannot tell a placeholder from an answer.

```ts
// Wrong
// TODO: handle the quota case
return null;

// Right
throw new Error("SCAFFOLD: implement in BE-S2-01");
```

**A wiring note is a comment,** used where real code exists but a dependency is still stubbed. It marks the seam and names the card.

```ts
// Right
// SCAFFOLD: real subdomain and cookie resolution lands in BE-S1-02 and BE-S1-03.
c.set("tenantId", DEV_TENANT_ID);
```

At HEAD: 8 throwing stubs and 3 wiring notes.

### 11.2 No dead code and no commented-out code

Delete it. Version control remembers.

## 12. Comments, commits and documents

### 12.1 Comments explain why, never what

The code states what it does. A comment earns its place by recording the reason a non-obvious choice was made, and cites the spec section or criterion behind it.

```ts
// Wrong
// loop over the tags
for (const tag of tags) {

// Right
// Truncated at write time, not read time, so extra rows cannot leak
// through another query. AC-05.05.
```

### 12.2 Conventional Commits, imperative, with the card and AC ids

```
feat(catalog): reject duplicate content on insert

Decided by UNIQUE (tenant_id, content_hash) so the second of two
simultaneous uploads loses on insert rather than on a read-then-check.

Refs: AC-03.01, AC-03.04, BE-S2-03

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`. Scope is the module or app. The `Co-Authored-By` trailer is required.

### 12.3 A PR updates the trackers it affects

Moving an operation from `SCAFFOLD` to `OK` in `api-specs/_index.md` is part of the card, not a follow-up.

### 12.4 Cite, do not restate

Link the spec section. A rule copied into a second place is a rule that will disagree with itself.

## 13. Formatting **(enforced)**

Biome owns formatting entirely: two-space indent, 100-column lines, double quotes, semicolons, trailing commas. Do not argue about it in review and do not restate its rules here.

```bash
bun run format        # writes
bun run format:check  # verifies
```

## 14. Known gaps at HEAD

Recorded so a reviewer is not surprised, and so nobody cites a rule the code does not yet meet.

| Gap | Where | Closes with |
|---|---|---|
| Five services are throwing `SCAFFOLD` stubs | `catalog`, `classification`, `enrichment`, `search`, `activity` | Their sprint cards |
| Route handlers return mocks, so 4.3 is not yet exercised | `apps/api/src/routes/` | Each sprint's backend cards |
| `.env.example` sync is a manual check, not a CI gate | 9.2 | Unscheduled, raise if it bites |
