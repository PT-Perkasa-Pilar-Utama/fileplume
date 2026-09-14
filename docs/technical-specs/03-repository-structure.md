# 03 — Repository Structure

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

Monorepo on Bun workspaces. One lockfile, one type-check pass, one lint config.

## 3.1 Tree

```
archiva/
├── apps/
│   ├── api/                     Hono HTTP server, the only public entry point
│   │   ├── src/
│   │   │   ├── routes/          One file per resource, Zod-validated
│   │   │   ├── middleware/      authn, tenant resolution, authz, request id, error mapper
│   │   │   ├── openapi.ts       OpenAPI document generated from the Zod schemas
│   │   │   └── index.ts         Composition root: builds adapters, wires modules
│   │   └── Dockerfile
│   ├── worker/                  BullMQ consumers, no HTTP surface except health
│   │   ├── src/
│   │   │   ├── jobs/            One file per job type
│   │   │   └── index.ts         Composition root for the worker
│   │   └── Dockerfile
│   └── web/                     React SPA, built to static assets
│       ├── src/
│       │   ├── routes/          TanStack Router file routes
│       │   ├── features/        One folder per module surface it consumes
│       │   ├── components/ui/   shadcn primitives
│       │   └── lib/api.ts       Typed client generated from the OpenAPI document
│       └── index.html
├── packages/
│   ├── db/                      Drizzle schema, migrations, seeds, client
│   │   ├── src/
│   │   │   ├── schema/          One file per module's tables
│   │   │   ├── migrations/      drizzle-kit output, resolved via import.meta.dir
│   │   │   ├── seeds/           dev.ts and qa.ts, both idempotent
│   │   │   │   └── internal/    Seed datasets, writers, and stable-key derivation
│   │   │   ├── client.ts        Connection from DATABASE_URL
│   │   │   └── migrate.ts       Migration runner, see 06-data-model.md 6.8
│   │   └── drizzle.config.ts
│   ├── tenancy/                 Module. Tenants, config parameters, quota
│   ├── identity/                Module. Users, sessions, roles, authorization
│   ├── catalog/                 Module. Documents, versions, blobs, download
│   ├── classification/          Module. Categories, permissions, assignment
│   ├── enrichment/              Module. Pipeline, text, tags, AI overrides
│   ├── search/                  Module. Index write and query
│   ├── activity/                Module. Audit ledger and analytics rollups
│   ├── platform/                Module. Health, reset-state, ops
│   ├── shared/                  Zod contracts, error types, result helpers, ids
│   └── config/                  Env parsing and validation, single source
├── scripts/
│   ├── build_ac_index.py        Regenerates the business AC index
│   ├── check_index.py           Verifies a numbered spec set matches disk
│   ├── check_ac_refs.py         Verifies every AC a task card cites exists
│   ├── recompute_summary.py     Recomputes the task board Summary table
│   ├── check_module_boundaries.ts  Fails on a cross-internal import
│   └── generate_fixtures.ts     Writes the QA fixture files
├── fixtures/                    Files the criteria name, uploaded by tests, never seeded
│   └── generated/               25 MB and EICAR fixtures. Gitignored, see fixtures/README.md
├── docs/                        business/, technical-specs/, api-specs/, grooming/
├── compose.yaml                 Dev and on-premises topology
├── compose.prod.yaml            Production overlay
├── biome.json
├── tsconfig.json                Root, strict, project references
└── package.json                 Workspaces, scripts
```

## 3.2 Module package shape

Every module package is identical in structure. This is enforced by review, and it is what makes the no-cross-internal-import rule checkable.

```
packages/<module>/
├── src/
│   ├── index.ts        THE public surface. Nothing else is importable.
│   ├── ports.ts        Interfaces this module needs injected
│   ├── service.ts      The behaviour. Depends on ports, never on concrete adapters.
│   ├── repository.ts   Drizzle queries scoped to this module's own tables
│   ├── errors.ts       Typed errors this module can return
│   └── internal/       Everything else. Importing across this line is a lint error.
└── package.json        "exports": { ".": "./src/index.ts" }
```

The `exports` map with a single entry is the mechanism: another package physically cannot reach `packages/catalog/src/internal/blob-key.ts`, because the package does not export that path.

## 3.3 Adapter placement

Adapters live with the app that composes them, not with the module that declares the port. `packages/catalog` declares `BlobStore`; `apps/api/src/adapters/s3-blob-store.ts` implements it against S3; `packages/catalog/src/testing/in-memory-blob-store.ts` implements it for tests and ships with the module.

This keeps every module importable in a test with no network, no container, and no environment variables.

## 3.4 Commands

| Command | Does |
|---|---|
| `bun install` | Install the whole workspace |
| `bun run dev` | Compose up the data services, then api, worker and web in watch mode |
| `bun run typecheck` | `tsc --build`, all packages |
| `bun run lint` | Biome check, including the no-internal-import rule |
| `bun run test` | `bun test`, unit and integration |
| `bun run test:e2e` | Playwright against a composed stack |
| `bun run db:generate` | drizzle-kit generate, writes a migration |
| `bun run db:migrate` | Apply migrations, see 06-data-model.md 6.8 |
| `bun run db:seed:dev` | Idempotent development seed |
| `bun run db:seed:qa` | Idempotent QA seed |
| `bun run build` | Build api, worker and web for production |
