# Archiva Onboarding Guide

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Tech Lead  
**Status:** Approved  
**Phase:** Release 1  

From cloned repository to a green build and your first change. Follow it in order.

## Contents

1. [What Archiva is](#1-what-archiva-is)
2. [Prerequisites](#2-prerequisites)
3. [Local setup](#3-local-setup)
4. [Codebase walkthrough](#4-codebase-walkthrough)
5. [What to read first](#5-what-to-read-first)
6. [Concepts to internalise](#6-concepts-to-internalise)
7. [Your first change](#7-your-first-change)
8. [Where to get help](#8-where-to-get-help)

## 1. What Archiva is

A multi-tenant document management system built by PT Perkasa Pilar Utama for client organisations.

A member of a client organisation drops a file on the dashboard. Archiva scans it for malware, extracts its text, asks an AI to propose a category and tags, and indexes every page. The member confirms or corrects the proposed category. Later, anyone in that organisation can search a phrase that appears on page 15 of a contract and land on page 15 with the phrase highlighted.

Around that sit three governance concerns that shape most of the code:

- **Tenant isolation.** Each client organisation is a tenant, identified by subdomain. One tenant's data must be unreachable from another, provably, including by guessing an identifier.
- **Download governance.** An administrator decides which categories may be downloaded at all, and the decision takes effect on the very next request.
- **Auditability.** Every consequential action is recorded, including refusals. A denied download is as important a record as a successful one.

The system is judged on 113 acceptance criteria across 30 user stories. Those criteria, not opinions about clean code, are the definition of correct.

## 2. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Bun | 1.4.2 | `bun --version` |
| Docker with compose plugin | any recent | `docker compose version` |
| Git | any recent | `git --version` |
| Python | 3.11 or later | `python --version` |
| GitHub CLI | optional, for issues | `gh --version` |

Python runs the document consistency checkers in CI. You need it only if you touch `docs/`.

Node.js is not required. Bun replaces the runtime, the package manager, the test runner and the bundler.

## 3. Local setup

```bash
# 1. Clone.
git clone https://github.com/PT-Perkasa-Pilar-Utama/fileplume.git
cd fileplume

# 2. Install the whole workspace. One lockfile, all packages.
bun install

# 3. Configure. The app exits non-zero on a missing or malformed value,
#    before it binds a port, so a broken .env fails loudly and early.
cp .env.example .env

# 4. Install the git hooks (format, typecheck, boundaries on commit).
bunx lefthook install

# 5. Verify the toolchain. Green before you change anything.
bun run complete-check
```

Expected: typecheck silent, Biome reporting no fixes needed, 65 tests passing.

### 3.1 Bring up the dependencies

```bash
docker compose up -d postgres opensearch valkey minio clamav gotenberg
docker compose ps
```

Six containers. The app itself runs from source in the next step. On a machine with under 8 GB of RAM, OpenSearch and ClamAV are the two that will struggle; see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) under Application runtime.

### 3.2 Run the app

```bash
bun run --filter '@archiva/api' dev     # terminal 1, port 3000
bun run --filter '@archiva/web' dev     # terminal 2, port 5173
```

```bash
curl -fsS http://localhost:3000/health/live | jq .
curl -fsS http://localhost:3000/api/v1/documents | jq .
```

The second returns a contract-valid mock. That is expected; see section 4.4.

### 3.3 What does not work yet

`bun run db:migrate` applies nothing and `bun run db:seed:dev` throws. No migrations have been generated and the seeds are stubs, both waiting on `TL-S0-02` and `TL-S0-03`. You need neither to start frontend work or to write service logic with its tests.

## 4. Codebase walkthrough

### 4.1 The map

```
fileplume/
├── apps/
│   ├── api/          Hono server. Routes, middleware, adapters, composition root
│   ├── worker/       BullMQ consumer. Runs the four pipeline stages
│   └── web/          React SPA. Routes, features, components, typed API client
├── packages/
│   ├── tenancy/      Tenants, config parameters, the quota reservation protocol
│   ├── identity/     Users, sessions, role floors
│   ├── catalog/      Documents, versions, blobs, download
│   ├── classification/  Categories, download permission, the confirmation window
│   ├── enrichment/   Pipeline state machine, extraction, tags, AI overrides
│   ├── search/       Index writes and queries
│   ├── activity/     Audit ledger and analytics rollups
│   ├── platform/     Health monitor, reset-state
│   ├── db/           Drizzle schema, migration runner, seeds
│   ├── shared/       Zod contracts, error taxonomy, Result, branded ids, roles
│   └── config/       The only module that reads the environment
├── docs/             Specs, standards, runbooks
└── scripts/          Consistency checkers, run in CI
```

Regenerate with `python scripts/repo_tree.py . --max-depth 2`.

### 4.2 Every module has the same shape

```
packages/catalog/src/
├── index.ts        the public surface, re-exports only
├── ports.ts        interfaces this module needs injected
├── service.ts      the behaviour, depends on ports never on adapters
├── repository.ts   Drizzle queries over this module's own tables
├── errors.ts       typed errors this module can return
├── internal/       everything else, unreachable from outside
├── testing/        in-memory adapters that ship with the module
└── service.test.ts beside the thing it tests
```

Learn one module and you can navigate all eight. Read `packages/tenancy` first: it is small, fully implemented, and its tests show the house style.

### 4.3 The boundary is enforced, not merely encouraged

Each package exports exactly one path. A deep import fails the linter and a CI script. The point is that a module stays extractable and testable, and that the quota protocol cannot leak into a route handler.

### 4.4 Why routes return mocks

Sprint 0 registered all 39 endpoints with contract-valid mock responses. This is deliberate: the frontend integrates from day one instead of waiting on backend cards, and each backend card replaces one mock with a real implementation. A `SCAFFOLD` marker throws with the card id that closes it, so you always know who owns the gap.

## 5. What to read first

Do not read everything. In this order, roughly two hours:

| Order | Doc | Why |
|---|---|---|
| 1 | [GLOSSARY.md](GLOSSARY.md) | The vocabulary. Everything else assumes it. |
| 2 | [technical-specs/01-overview.md](technical-specs/01-overview.md) | Goals, scope, the workflow in pseudocode |
| 3 | [technical-specs/02-system-architecture.md](technical-specs/02-system-architecture.md) | Why a modular monolith plus one worker |
| 4 | [CODING_STANDARD.md](CODING_STANDARD.md) | The rules review enforces verbatim |
| 5 | [DEVELOPMENT_SCENARIO_GUIDE.md](DEVELOPMENT_SCENARIO_GUIDE.md) | How to complete a task end to end |
| 6 | One file in [business/acceptance-criteria-breakdown/](business/acceptance-criteria-breakdown/) | What a criterion actually looks like |
| 7 | [design/](design/) | The Figma file, if you are working on the frontend |

Read the rest when a card points you at it. `technical-specs/06-data-model.md`, `api-specs/`, `12-document-processing-pipeline.md` and `13-search-indexing-strategy.md` are references, not reading material.

## 6. Concepts to internalise

Six things explain most of the surprising decisions in this codebase. Full definitions in [GLOSSARY.md](GLOSSARY.md).

**Tenant isolation is a data-layer property.** Repository helpers take a tenant id as a required first argument, so a query that omits it does not compile. A cross-tenant identifier returns 404, never 403, because 403 would confirm the row exists.

**A hidden control is not a security measure.** Every permission is enforced server-side and tested by asserting the refusal status against the endpoint. Never by asserting a button is disabled.

**Read-then-decide is a bug wherever two requests can race.** Duplicate uploads lose on a unique constraint. Version numbers are allocated under a row lock. Quota is reserved, never checked.

**The pipeline is at-least-once.** Processing is idempotent by requirement: a redelivered job for a ready document is a no-op, and a transition guard stops a stale job moving a document backwards.

**Indonesian strings are contract.** They are quoted verbatim from acceptance criteria, defined once on the server, and rendered by the client as given. A paraphrase passes review and fails the acceptance test.

**The confirmation window has no stored state.** An unconfirmed document is uploader-only until it ages out, decided by a predicate rather than a flag, so no sweeper can be late and no document can be stranded.

## 7. Your first change

Pick something small in your lane. A good first backend card is `BE-S1-01`; a good first frontend card is `FE-S1-03`.

```bash
gh issue list -R PT-Perkasa-Pilar-Utama/fileplume --label sprint:1 --state open
gh issue edit <number> --add-assignee @me
git switch -c <card-id-lowercase>-<slug>
```

Then follow [DEVELOPMENT_SCENARIO_GUIDE.md](DEVELOPMENT_SCENARIO_GUIDE.md) section 3 or 4. Before opening the PR:

```bash
bun run complete-check
```

## 8. Where to get help

| Question | Where |
|---|---|
| Something is broken locally | [TROUBLESHOOTING.md](TROUBLESHOOTING.md), symptom-indexed |
| A defect, or behaviour you cannot explain | Open a GitHub issue with the bug template |
| What should this actually do? | The acceptance criteria. If they are silent or contradictory, raise it via `/grooming` rather than deciding alone |
| Architecture, or why a decision was made | The technical specs record the reasoning. If they do not, ask the Tech Lead |
| Access, secrets, environments, deploys | Tech Lead |
| A rule seems wrong | Argue it against [CODING_STANDARD.md](CODING_STANDARD.md). If the rule is wrong, change the standard rather than quietly ignoring it |

A question the docs should have answered but did not is a documentation defect. Fix the doc in the same PR as your change.
