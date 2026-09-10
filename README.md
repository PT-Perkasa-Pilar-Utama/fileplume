# Archiva

Multi-tenant document management, built by PT Perkasa Pilar Utama.

Members of a client organisation upload documents. Archiva extracts the text, classifies it against a governed taxonomy, and makes it findable by title, metadata, tag, category, and by the words inside the file. Administrators govern who may download what, and every consequential action is recorded.

Each client organisation is a tenant, isolated by subdomain and enforced at the data layer.

## Contents

- [What problem it solves](#what-problem-it-solves)
- [Stack](#stack)
- [Quickstart](#quickstart)
- [Repository layout](#repository-layout)
- [Documentation](#documentation)
- [Project status](#project-status)
- [License](#license)

## What problem it solves

Five goals govern every design decision. They are the tie-breaker when two approaches look equally good.

1. A member can put a document in and find it again by its contents, without organising it by hand.
2. Classification is proposed by the system and confirmed by a person, so accuracy is measurable rather than assumed.
3. Data belonging to one organisation is unreachable from another, provably, including by direct identifier.
4. Download of sensitive categories is governable, and every access attempt is on the record.
5. Nothing fails silently. A document whose processing breaks stays visible, usable, and explains itself.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Bun 1.3.8 |
| Language | TypeScript 7.0.2, strict, ESM only |
| API | Hono 4, Zod 4 validation, OpenAPI generated from the same schemas |
| Frontend | React 19, Vite 8, TanStack Router and Query, Tailwind 4, shadcn/ui |
| Database | PostgreSQL 17 via Drizzle ORM |
| Search | OpenSearch 2, one index document per page |
| Queue and cache | BullMQ on Valkey 8 |
| Object storage | S3 API: MinIO locally, R2 or S3 in cloud |
| Sidecars | ClamAV for malware, Gotenberg for Office to PDF |
| AI | Claude behind a port, with a self-hostable adapter |
| Tooling | Biome 2, lefthook, Playwright, Testcontainers |

Full justification for every row, and what was deliberately rejected, is in [technical-specs/04-tech-stack.md](docs/technical-specs/04-tech-stack.md).

## Quickstart

Prerequisites: Bun 1.3.8, Docker with the compose plugin, Git.

```bash
# 1. Clone and install the workspace.
git clone https://github.com/PT-Perkasa-Pilar-Utama/fileplume.git
cd fileplume
bun install

# 2. Configure. The app refuses to boot on a missing or malformed value.
cp .env.example .env

# 3. Bring up the datastores and sidecars.
docker compose up -d postgres opensearch valkey minio clamav gotenberg

# 4. Verify the toolchain before writing anything.
bun run complete-check
```

`complete-check` runs typecheck, lint, format check and the test suite. It must pass before any task is considered complete.

Migrations and seeds are not yet runnable; see [Project status](#project-status).

## Repository layout

```
fileplume/
├── apps/
│   ├── api/          Hono HTTP server, the only public entry point
│   ├── worker/       BullMQ consumer, runs the document pipeline
│   └── web/          React SPA, built to static assets
├── packages/
│   ├── tenancy/      Tenants, config parameters, storage quota
│   ├── identity/     Users, sessions, roles, authorization
│   ├── catalog/      Documents, versions, blobs, download
│   ├── classification/  Categories, permissions, assignment
│   ├── enrichment/   Pipeline, text extraction, tags, AI overrides
│   ├── search/       Index write and query
│   ├── activity/     Audit ledger and analytics rollups
│   ├── platform/     Health monitor, reset-state, ops
│   ├── db/           Drizzle schema, migrations, seeds, client
│   ├── shared/       Zod contracts, error taxonomy, Result, branded ids
│   └── config/       Environment parsing and validation, single source
├── docs/             Business, technical specs, API specs, ops runbooks
├── scripts/          Document and boundary checkers run in CI
├── compose.yaml      Dev topology, also the on-premises artifact
├── compose.prod.yaml Production overlay: pinned images, no exposed datastores
└── Caddyfile         TLS, static SPA, reverse proxy
```

Every module package has the same six-part shape. A module is importable only through `src/index.ts`; reaching into another module's `internal/` fails both the linter and a CI check. See [technical-specs/03-repository-structure.md](docs/technical-specs/03-repository-structure.md).

Regenerate this tree rather than editing it by hand:

```bash
python scripts/repo_tree.py . --max-depth 2
```

## Documentation

Read in this order. Each doc owns its subject; nothing is duplicated between them.

| Doc | Answers |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Operating manual. Read before touching the repo. |
| [ONBOARDING_GUIDE.md](docs/ONBOARDING_GUIDE.md) | How do I get set up and find my way around? |
| [DEVELOPMENT_SCENARIO_GUIDE.md](docs/DEVELOPMENT_SCENARIO_GUIDE.md) | How do I complete a task end to end? |
| [GLOSSARY.md](docs/GLOSSARY.md) | What does this word mean here? |
| [CODING_STANDARD.md](docs/CODING_STANDARD.md) | What rules does review enforce? |
| [CODE_REVIEW_CHECKLIST.md](docs/CODE_REVIEW_CHECKLIST.md) | What do I check on a PR? |
| [business/](docs/business/) | What must the system do? 30 stories, 113 acceptance criteria |
| [technical-specs/](docs/technical-specs/) | How is it built? Architecture, data model, security |
| [api-specs/](docs/api-specs/) | What is the wire contract? 39 operations |
| [TASK_BREAKDOWN.md](docs/TASK_BREAKDOWN.md) | What is the work? 76 cards across 6 sprints |
| [DEPLOYMENT_PLAN.md](docs/DEPLOYMENT_PLAN.md) | How does it deploy, reset, and roll back? |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | It is broken. Where do I look? |

Two documents are the single source of truth for their concern and must be cited rather than restated: [12-document-processing-pipeline.md](docs/technical-specs/12-document-processing-pipeline.md) and [13-search-indexing-strategy.md](docs/technical-specs/13-search-indexing-strategy.md).

## Project status

Sprint 0 scaffold is complete and green. The application is **not yet functional**: routes return contract-valid mocks so the frontend can integrate from day one, and five services are typed stubs that throw with the card id that replaces them.

| Area | State |
|---|---|
| Toolchain, CI, hooks, compose stack | Working |
| API routes | 39 registered, returning mocks |
| Modules | Interfaces and tests real, service bodies stubbed |
| Database schema | `tenancy` and the enums only |
| Migrations and seeds | Not yet generated; see `TL-S0-02`, `TL-S0-03` |
| Tests | 65 passing, covering pure logic and route wiring |

Work is tracked as [GitHub issues](https://github.com/PT-Perkasa-Pilar-Utama/fileplume/issues), one per card, grouped into six sprint milestones.

## Language policy

Two languages, with a hard split. Code identifiers, table and column names, API field names and log messages are **English**. User-facing interface copy, messages and errors are **Indonesian**, quoted verbatim from the acceptance criterion. Never translate one in code, and never assert on an English paraphrase in a test.

## License

Proprietary. Copyright PT Perkasa Pilar Utama. All rights reserved. Not for redistribution.
