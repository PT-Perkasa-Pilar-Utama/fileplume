# Archiva API Specifications

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

The wire contract. `../technical-specs/` decides what modules exist and what data they own; this set pins down the exact request a client sends and the response a server must honor.

Every operation is a projection of a module surface in [../technical-specs/05-module-definitions.md](../technical-specs/05-module-definitions.md) and a field in [../technical-specs/06-data-model.md](../technical-specs/06-data-model.md). Nothing here invents an entity or a field those documents do not have.

**Protocol:** REST over JSON, fixed in [../technical-specs/04-tech-stack.md 4.2](../technical-specs/04-tech-stack.md). GraphQL was considered and rejected in 4.9.

**Base address:** `https://<subdomain>.archiva.id/api/v1` for tenant operations, `https://admin.archiva.id/api/v1` for Super Admin, and unversioned root paths for the operational endpoints. See [01-conventions.md 1.1](01-conventions.md).

Sections are numbered within each file so an operation can be cited as a stable anchor from a task card, a stub or a review, for example `api-specs/05-documents.md 5.9`.

## Files in this directory

| # | Document | Module | Covers |
|---|---|---|---|
| 01 | [Conventions](01-conventions.md) | | Base address, envelopes, pagination, status and error codes, idempotency, rate limits, role reference, deviations |
| 02 | [Authentication](02-authentication.md) | identity | Login, logout, session resolution, role-derived navigation |
| 03 | [Tenants](03-tenants.md) | tenancy | Super Admin tenant creation, listing, quota |
| 04 | [Configuration and Storage](04-configuration.md) | tenancy | The closed config key set, parameter edit and reset, storage indicator |
| 05 | [Documents](05-documents.md) | catalog | Batch upload, list, detail, versions, preview, download, bulk download |
| 06 | [Categories and Classification](06-categories.md) | classification | Taxonomy, download permission, category confirmation, review queue |
| 07 | [Enrichment](07-enrichment.md) | enrichment | Processing state, metadata, AI field correction, tags, Top Tags, reprocess |
| 08 | [Search](08-search.md) | search | Title search, deep content search, related documents |
| 09 | [Activity](09-activity.md) | activity | Audit trail, analytics dashboard |
| 10 | [System](10-system.md) | platform | Health monitor, reset database state |

## Operation status tracker

The at-a-glance build state. Task cards and Tech Lead stubs sync against this table.

**Legend:** `OK` implemented and tested. `WIP` in progress. `TODO` not started. `SCAFFOLD` stub returning a mock.

### Authentication

| Operation | Spec | Sprint | Status |
|---|---|---|---|
| `POST /auth/login` | [02 2.2](02-authentication.md) | 1 | SCAFFOLD |
| `POST /auth/logout` | [02 2.3](02-authentication.md) | 1 | SCAFFOLD |
| `GET /auth/me` | [02 2.4](02-authentication.md) | 1 | SCAFFOLD |

### Tenants

| Operation | Spec | Sprint | Status |
|---|---|---|---|
| `POST /tenants` | [03 3.1](03-tenants.md) | 1 | SCAFFOLD |
| `GET /tenants` | [03 3.2](03-tenants.md) | 1 | SCAFFOLD |
| `PATCH /tenants/:tenantId/quota` | [03 3.3](03-tenants.md) | 2 | SCAFFOLD |

### Configuration and storage

| Operation | Spec | Sprint | Status |
|---|---|---|---|
| `GET /configuration` | [04 4.2](04-configuration.md) | 2 | SCAFFOLD |
| `PATCH /configuration/:key` | [04 4.3](04-configuration.md) | 2 | SCAFFOLD |
| `DELETE /configuration/:key` | [04 4.4](04-configuration.md) | 2 | SCAFFOLD |
| `GET /storage` | [04 4.5](04-configuration.md) | 2 | SCAFFOLD |

### Documents

| Operation | Spec | Sprint | Status |
|---|---|---|---|
| `POST /documents` | [05 5.2](05-documents.md) | 2 | SCAFFOLD |
| `GET /documents` | [05 5.4](05-documents.md) | 2 | SCAFFOLD |
| `GET /documents/:id` | [05 5.5](05-documents.md) | 2 | SCAFFOLD |
| `GET /documents/:id/versions` | [05 5.6](05-documents.md) | 2 | SCAFFOLD |
| `POST /documents/:id/versions` | [05 5.7](05-documents.md) | 2 | SCAFFOLD |
| `GET /documents/:id/preview` | [05 5.8](05-documents.md) | 4 | SCAFFOLD |
| `POST /documents/:id/download` | [05 5.9](05-documents.md) | 5 | SCAFFOLD |
| `POST /documents/download-bulk` | [05 5.10](05-documents.md) | 5 | SCAFFOLD |
| `GET /documents/download-bulk/:ticketId` | [05 5.11](05-documents.md) | 5 | SCAFFOLD |

### Categories and classification

| Operation | Spec | Sprint | Status |
|---|---|---|---|
| `GET /categories` | [06 6.2](06-categories.md) | 3 | SCAFFOLD |
| `POST /categories` | [06 6.3](06-categories.md) | 3 | SCAFFOLD |
| `PATCH /categories/:id` | [06 6.4](06-categories.md) | 3 | SCAFFOLD |
| `PUT /categories/:id/download-permission` | [06 6.5](06-categories.md) | 5 | SCAFFOLD |
| `PUT /documents/:id/classification` | [06 6.6](06-categories.md) | 3 | SCAFFOLD |
| `GET /documents/unconfirmed` | [06 6.8](06-categories.md) | 3 | SCAFFOLD |

### Enrichment

| Operation | Spec | Sprint | Status |
|---|---|---|---|
| `GET /documents/:id/processing` | [07 7.2](07-enrichment.md) | 3 | SCAFFOLD |
| `PATCH /documents/:id/fields` | [07 7.4](07-enrichment.md) | 3 | SCAFFOLD |
| `PUT /documents/:id/tags` | [07 7.5](07-enrichment.md) | 3 | SCAFFOLD |
| `POST /documents/:id/reprocess` | [07 7.6](07-enrichment.md) | 3 | SCAFFOLD |
| `GET /tags/top` | [07 7.7](07-enrichment.md) | 3 | SCAFFOLD |

### Search

| Operation | Spec | Sprint | Status |
|---|---|---|---|
| `GET /search/titles` | [08 8.2](08-search.md) | 4 | SCAFFOLD |
| `GET /search/content` | [08 8.3](08-search.md) | 4 | SCAFFOLD |
| `GET /documents/:id/related` | [08 8.4](08-search.md) | 4 | SCAFFOLD |

### Activity

| Operation | Spec | Sprint | Status |
|---|---|---|---|
| `GET /audit-events` | [09 9.2](09-activity.md) | 5 | SCAFFOLD |
| `GET /analytics/dashboard` | [09 9.3](09-activity.md) | 5 | SCAFFOLD |

### System

| Operation | Spec | Sprint | Status |
|---|---|---|---|
| `GET /health/live` | [10 10.2](10-system.md) | 1 | SCAFFOLD |
| `GET /health/ready` | [10 10.3](10-system.md) | 1 | SCAFFOLD |
| `POST /admin/reset-state` | [10 10.4](10-system.md) | 1 | SCAFFOLD |
| `GET /admin/reset-state/:jobId` | [10 10.5](10-system.md) | 1 | SCAFFOLD |

**Total: 39 operations.** Sprint numbers follow [../business/sprint-breakdown.md](../business/sprint-breakdown.md); an operation is listed in the earliest sprint whose criteria need it.

## Stories with no operation

Three release-1 stories are satisfied entirely in the client. They are listed so the tracker's coverage can be checked against the sprint plan without a false gap.

| Story | Where it lives | Detail |
|---|---|---|
| US-36, theme | `localStorage` in the SPA | [01 1.14](01-conventions.md) |
| US-37, local table filter | TanStack Table over a loaded page, plus `GET /audit-events?q=` for the audit trail | [01 1.14](01-conventions.md), [09 9.2](09-activity.md) |
| US-39, pagination | The `meta` object on every collection | [01 1.5](01-conventions.md) |

## Open items

Each needs a decision or an amendment before the affected operation is built. Full table with reasons in [01-conventions.md 1.13](01-conventions.md).

| # | Item | Blocks | Amend |
|---|---|---|---|
| 1 | AC-43.03 and AC-43.04 say status 403; the security spec says 404 for cross-tenant ids | [05 5.5](05-documents.md), [05 5.9](05-documents.md) | `../business/acceptance-criteria-breakdown/acceptance-criteria-sprint-1.md` |
| 2 | `audit_action` has no member for a denied route access. AC-41.05 asserts one is written. | Every guarded operation | `../technical-specs/06-data-model.md` 6.9 |
| 3 | `audit_action` has no member for a search. AC-12.02 needs search volume and zero-result rate. | [08 8.1](08-search.md), [09 9.3](09-activity.md) | `../technical-specs/06-data-model.md` 6.9 |
| 4 | `tenancy.setConfigValue` has no reset path; AC-42.05 requires one | [04 4.4](04-configuration.md) | `../technical-specs/05-module-definitions.md` 5.1 |
| 5 | No address is defined for a tenant-less Super Admin principal. This set reserves the `admin` subdomain. | [03](03-tenants.md) | `../technical-specs/09-authentication-authorization.md` 9.4 |
| 6 | AC-42.01 lists storage quota on the Configuration page without a read-only marker | [04 4.2](04-configuration.md) | Already flagged in `../technical-specs/01-overview.md` 1.7 item 11 |

## Companion documents

| Document | Path | Status |
|---|---|---|
| Technical specifications | [../technical-specs/](../technical-specs/) | Approved |
| Module definitions | [../technical-specs/05-module-definitions.md](../technical-specs/05-module-definitions.md) | The source of every operation here |
| Data model | [../technical-specs/06-data-model.md](../technical-specs/06-data-model.md) | The source of every field here |
| Processing pipeline | [../technical-specs/12-document-processing-pipeline.md](../technical-specs/12-document-processing-pipeline.md) | Single source for pipeline rules. Cite, do not restate. |
| Search indexing strategy | [../technical-specs/13-search-indexing-strategy.md](../technical-specs/13-search-indexing-strategy.md) | Single source for search rules. Cite, do not restate. |
| User stories | [../business/user-story.md](../business/user-story.md) | Written |
| Acceptance criteria index | [../business/acceptance-criteria.md](../business/acceptance-criteria.md) | Generated |
| Acceptance criteria bodies | [../business/acceptance-criteria-breakdown/](../business/acceptance-criteria-breakdown/) | Written |
| Sprint breakdown | [../business/sprint-breakdown.md](../business/sprint-breakdown.md) | Written |
| Grooming decision record | [../grooming/grooming-archiva-interview.md](../grooming/grooming-archiva-interview.md) | Written |
| Glossary | [../GLOSSARY.md](../GLOSSARY.md) | Not yet written |
| Coding standard | [../CODING_STANDARD.md](../CODING_STANDARD.md) | Not yet written |
| Task breakdown | [../TASK_BREAKDOWN.md](../TASK_BREAKDOWN.md) | Next in the pipeline |
| Deployment plan | [../DEPLOYMENT_PLAN.md](../DEPLOYMENT_PLAN.md) | Not yet written |

## Next step in the pipeline

`task-breakdown` turns each operation above into a task card citing its spec anchor, and `tech-lead-setups` stubs the routes so the tracker can move rows to `SCAFFOLD`.

## Maintaining this set

The generated OpenAPI document is the machine-readable companion to these files. It is emitted by `@hono/zod-openapi` from the same Zod schemas the handlers validate against, so it cannot drift from the implementation. It can drift from this prose, which is why each operation here names its Zod contract's home in `packages/shared`.

When an operation is added, removed or renumbered:

1. Update the resource file and keep section numbers stable for operations that did not move.
2. Update the operation status tracker above.
3. Update the Files in this directory table if a file was added or renamed.
4. If a new error code appears, add it to the resource file's code table and, if it is cross-cutting, to [01-conventions.md 1.8](01-conventions.md).
