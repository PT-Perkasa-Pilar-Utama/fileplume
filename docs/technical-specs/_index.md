# Archiva Technical Specifications

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

How Archiva is built. The business documents define what is built; this set defines how. Every decision here traces to an acceptance criterion in `../business/` or to a numbered decision in `../grooming/grooming-archiva-interview.md`.

Sections are numbered within each file so they can be cited as stable anchors from task cards and reviews, for example `technical-specs/06-data-model.md 6.6`.

## Table of Contents

| # | Document | Covers |
|---|---|---|
| 01 | [Overview](01-overview.md) | Goals, scope by module, out of scope, language policy, workflow pseudocode, assumptions |
| 02 | [System Architecture](02-system-architecture.md) | Modular monolith plus worker, component graph, request lifecycle, deployment, boundary map |
| 03 | [Repository Structure](03-repository-structure.md) | Monorepo tree, module package shape, adapter placement, commands |
| 04 | [Tech Stack](04-tech-stack.md) | Every technology with its justification, what we deliberately do not use, version pinning |
| 05 | [Module Definitions](05-module-definitions.md) | The eight modules, their interfaces and invariants, seams, operational endpoints |
| 06 | [Data Model](06-data-model.md) | ERD, every table, the dedupe matrix, state machines, migrations and seeding |
| 07 | [Security](07-security.md) | Authn, authz, tenant isolation, request hardening, operational endpoint policy, threat surface |
| 08 | [Non-Functional Requirements](08-nfr.md) | Volume, latency budgets, throughput, availability, accuracy and observability targets |
| 09 | [Authentication and Authorization](09-authentication-authorization.md) | Role model, session strategy, the full role matrix, tenant resolution order |
| 10 | [Integration Points](10-integration-points.md) | Six external dependencies: contract, adapters, failure mode, fallback |
| 11 | [Environment Configuration](11-environment-configuration.md) | Every variable per environment, including the reset-endpoint gating |
| 12 | [Document Processing Pipeline](12-document-processing-pipeline.md) | Ad-hoc. State machine, retry, idempotency, stage contracts, races |
| 13 | [Search Indexing Strategy](13-search-indexing-strategy.md) | Ad-hoc. Page-level index model, analyzers, highlighting, reindex |

Documents 12 and 13 are ad-hoc specifications for cross-cutting concerns. Each is the single source of truth for its concern. **Cite them; do not restate their rules elsewhere.**

## Key decisions at a glance

| Decision | Value | Where |
|---|---|---|
| Architecture | Modular monolith, two deployables | 02 2.1 |
| Stack | Bun, TypeScript, Hono, React, Drizzle, PostgreSQL 17 | 04 |
| Search | OpenSearch, one index document per page | 13 13.1 |
| Queue | BullMQ on Valkey | 04 4.2 |
| Sessions | Database-backed cookie, not JWT | 09 9.2 |
| Tenancy | Shared schema, tenant discriminator, enforced at the data layer | 07 7.3 |
| AI | Hosted provider behind a port, self-hostable adapter available | 10 10.6 |
| Hosting | Docker Compose on a single VPS, doubling as the on-premises artifact | 02 2.4 |
| Reset endpoint | Not registered in production, asserted by a CI test | 07 7.6.2 |

## Companion Documents

| Document | Path | Status |
|---|---|---|
| User stories | [../business/user-story.md](../business/user-story.md) | Written |
| Sprint breakdown | [../business/sprint-breakdown.md](../business/sprint-breakdown.md) | Written |
| Acceptance criteria index | [../business/acceptance-criteria.md](../business/acceptance-criteria.md) | Generated |
| Acceptance criteria bodies | [../business/acceptance-criteria-breakdown/](../business/acceptance-criteria-breakdown/) | Written |
| Combined US and AC source | [../us-ac/User-Stories-and-AC.md](../us-ac/User-Stories-and-AC.md) | Written |
| Grooming decision record | [../grooming/grooming-archiva-interview.md](../grooming/grooming-archiva-interview.md) | Written |
| Grooming question set | [../grooming/grooming-archiva-backlog.md](../grooming/grooming-archiva-backlog.md) | Written |
| Glossary | [../GLOSSARY.md](../GLOSSARY.md) | Written |
| Onboarding guide | [../ONBOARDING_GUIDE.md](../ONBOARDING_GUIDE.md) | Written |
| Development scenario guide | [../DEVELOPMENT_SCENARIO_GUIDE.md](../DEVELOPMENT_SCENARIO_GUIDE.md) | Written |
| API specifications | [../api-specs/](../api-specs/) | Written |
| Coding standard | [../CODING_STANDARD.md](../CODING_STANDARD.md) | Written |
| Code review checklist | [../CODE_REVIEW_CHECKLIST.md](../CODE_REVIEW_CHECKLIST.md) | Written |
| Task breakdown | [../TASK_BREAKDOWN.md](../TASK_BREAKDOWN.md) | Written |
| Deployment plan | [../DEPLOYMENT_PLAN.md](../DEPLOYMENT_PLAN.md) | Written |
| Troubleshooting guide | [../TROUBLESHOOTING.md](../TROUBLESHOOTING.md) | Living skeleton |

## Next step in the pipeline

`api-spec` projects the module surfaces in 05 and the data model in 06 into REST endpoint contracts under `../api-specs/`, as numbered `NN-topic.md` files plus an `_index.md`.

## Maintaining this set

After adding, removing or renumbering a file, verify the index still matches disk:

```bash
python scripts/check_index.py --specs-dir docs/technical-specs
```

Non-zero exit means the table of contents and the directory disagree.
