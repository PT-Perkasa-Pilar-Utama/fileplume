# 04 — Tech Stack

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

Every row was confirmed during the technical-spec grill. Versions are pinned; see 4.10 for the policy.

## 4.1 Runtime and language

| Component | Technology | Justification |
|---|---|---|
| Runtime | Bun 1.2.x | One binary for install, run, test and bundle. Native `Bun.password` and S3 client remove two dependencies. |
| Language | TypeScript 5.9 | `strict: true`, `noUncheckedIndexedAccess: true` |
| Module system | ESM only | Bun native, no dual-publish complexity in the workspace |

## 4.2 Backend

| Component | Technology | Justification |
|---|---|---|
| HTTP framework | Hono 4.x | Web-standard Request and Response, so route handlers are testable without a server |
| API style | REST over JSON | `api-spec` runs next and projects module surfaces into endpoint contracts |
| Validation | Zod 4.x + `@hono/zod-validator` | One schema is the runtime validator, the static type, and the OpenAPI source |
| API documentation | `@hono/zod-openapi` | Generated from the same Zod schemas, so it cannot drift from the handler |
| Data layer | Drizzle ORM 0.44.x | SQL-shaped, no hidden N+1, migrations are generated files under review |
| Migrations | drizzle-kit | See 06-data-model.md 6.8 for the runner rule |
| Job queue | BullMQ 5.x | Retry with exponential backoff satisfies AC-44.02, queue-depth metrics satisfy D13 |
| Logging | pino | Structured JSON, one line per request, low overhead |
| Tracing | OpenTelemetry SDK | Spans across api, worker, database and OpenSearch for D13 alerting |

## 4.3 Frontend

| Component | Technology | Justification |
|---|---|---|
| Framework | React 19 | Named in the brief |
| Build | Vite 7 | SPA served as static assets by Caddy; the Hono API stays the single backend |
| Rendering | Client-side SPA | Every screen is behind authentication, so SSR buys no SEO and no meaningful first paint here |
| Routing | TanStack Router | Type-safe routes and search params, so US-34 and US-05 filter state lives in the URL |
| Server state | TanStack Query | Cache, refetch and the polling that AC-44.01 status transitions need |
| Client state | Zustand | Only genuinely local state: theme, filter drafts, upload tray |
| Styling | Tailwind CSS 4 | |
| Components | shadcn/ui | Owned source, not a dependency. Its theme layer gives US-36 dark mode with a class toggle. |
| Forms | React Hook Form + Zod resolver | The same Zod schema validates on the client and the server |
| Table | TanStack Table | US-37 local filtering, US-39 pagination |
| PDF preview | `pdf.js` via `react-pdf` | AC-09.01 native render with no download |

## 4.4 Datastores

| Component | Technology | Justification |
|---|---|---|
| Primary database | PostgreSQL 17 | Named in the brief |
| Search index | OpenSearch 2.x | At 100k documents times 50 pages per tenant, memory-resident engines are out. AC-33.01 needs page-level fragment highlighting, which OpenSearch does natively. Apache 2.0, so on-premises stays possible. |
| Cache and queue backing | Valkey 8 | BSD-licensed Redis fork. Backs BullMQ and caches the US-05 Top Tags aggregation. |
| Object storage | S3 API: Cloudflare R2 or AWS S3 in cloud, MinIO on-premises | One SDK against both targets, so US-31 needs no rewrite |
| Malware scanning | ClamAV via clamd TCP | AC-46.02. Self-hostable by nature, signature updates are a container concern |
| Document conversion | Gotenberg 8 | AC-09.02 DOCX, XLSX and TXT preview without LibreOffice inside the application image |

## 4.5 AI and text extraction

| Component | Technology | Justification |
|---|---|---|
| Native text extraction | `unpdf` for PDF, `mammoth` for DOCX, `exceljs` for XLSX | Runs in-process, no sidecar for the common case |
| OCR, production | Hosted document AI service behind the `TextExtractor` port | Quality on Indonesian scans |
| OCR, on-premises and test | Tesseract with `ind` and `eng` traineddata | The self-hostable adapter that keeps US-31 open |
| Classification, tagging, metadata | Claude via the Anthropic API, behind the `AiProvider` port | `claude-sonnet-5` for classification, `claude-haiku-4-5` for tagging |
| Prompt and model versioning | Pinned model id plus a versioned prompt template in `packages/enrichment` | An accuracy metric is meaningless if the model silently changes underneath it |

The port is not optional decoration. Grooming D8 chose hosted inference on condition that the provider is abstracted, because US-31 customers may forbid content leaving their boundary.

## 4.6 Security

| Component | Technology | Justification |
|---|---|---|
| Authentication | better-auth | A library, not a service, so on-premises needs no external IdP. Drizzle adapter, Hono handler. |
| Session | Database-backed, httpOnly SameSite=Lax cookie | AC-14.02 requires a permission change to bite immediately; a stateless JWT cannot |
| Password hashing | Argon2id via `Bun.password` | Native, no dependency |
| Transport | TLS terminated at Caddy | Automatic certificate management |
| Headers | `hono/secure-headers` | CSP, HSTS, frame denial; see 07-security.md |
| Rate limiting | `hono-rate-limiter` backed by Valkey | Login and search endpoints |

## 4.7 Testing and CI

| Component | Technology | Justification |
|---|---|---|
| Unit and integration | `bun test` | Built in, fast, no configuration |
| Database tests | Testcontainers for PostgreSQL | Real Postgres, real migrations, throwaway per suite |
| API contract | Route tests through Hono `app.request()` | No server socket needed |
| End to end | Playwright | One spec per acceptance criterion on the main flows |
| Lint and format | Biome 2.x | Replaces ESLint and Prettier with one tool and one pass |
| CI | GitHub Actions | typecheck, lint, test, build, e2e against a composed stack |

## 4.8 Deployment

| Component | Technology | Justification |
|---|---|---|
| Containerization | Docker, multi-stage, `oven/bun:1-slim` runtime | Small image without the toolchain |
| Orchestration | Docker Compose on a single VPS | Cheapest to operate at launch and doubles as the on-premises artifact |
| Reverse proxy | Caddy 2 | TLS, static SPA hosting, API reverse proxy in one small config |
| Migrations at deploy | One-shot `migrate` container that exits before `api` starts | See 06-data-model.md 6.8 |

## 4.9 What we deliberately do NOT use

| Tool | Reason |
|---|---|
| Next.js | Every screen is authenticated. SSR adds a second server and a second runtime model for no user-visible gain here. |
| Prisma | A binary query engine and a proprietary schema language, against Drizzle's plain SQL and TypeScript. |
| Elasticsearch | Licence. OpenSearch is Apache 2.0 and on-premises is a stated roadmap item. |
| Meilisearch, Typesense | Memory-resident. Five million page documents per tenant makes them expensive or impossible. |
| Clerk, Auth0, WorkOS | Managed-only. They would make US-31 undeliverable. |
| Kafka | One producer, one consumer group, thousands of jobs a day. BullMQ is the right size. |
| Redis after 7.4 | Licence change. Valkey is the BSD continuation. |
| ESLint plus Prettier | Two tools, two configs, slower. Biome does both. |
| Kubernetes | No horizontal scaling requirement at release 1, and it would force every on-premises customer to run a cluster. |
| GraphQL | One first-party client with well-known screens. REST plus generated types is less machinery. |
| Microservices | See 02-system-architecture.md 2.1.1. |

## 4.10 Version pinning policy

1. `package.json` pins exact versions. No caret, no tilde. `bun.lock` is committed.
2. Container images pin a minor tag and a digest, for example `postgres:17.2@sha256:...`.
3. AI model identifiers are pinned exactly. A model change is a code change, reviewed like any other, because it invalidates the accuracy baseline in AC-12.03.
4. Dependencies are reviewed monthly in one batch. Security advisories are exempt and land immediately.
5. Major upgrades of PostgreSQL, OpenSearch or Bun require a written migration note and a staging soak.
