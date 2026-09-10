# 09 — Activity

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

The record of what happened, and the aggregations read from it. Module: `activity` ([../technical-specs/05-module-definitions.md 5.7](../technical-specs/05-module-definitions.md)). Entities: `audit_events`, `analytics_rollups` ([../technical-specs/06-data-model.md 6.9](../technical-specs/06-data-model.md)).

Conventions in [01-conventions.md](01-conventions.md) apply.

Two views over one ledger. Analytics is a read model over what audit writes; splitting them would either break the module import rule or force audit to expose a wide query surface that defeats its own depth ([../technical-specs/05-module-definitions.md 5.7](../technical-specs/05-module-definitions.md)).

## 9.1 What writes to the ledger

There is no operation that creates an audit event. `activity.record` is called by other modules, never by a client, and the ledger is append-only: no update path and no delete path exists in the public surface (module invariant 5.7.3).

`record` never throws into the caller's path. A failure to audit is logged and alerted but does not fail a download the user was entitled to (module invariant 5.7.4). The consequence for this API is that a `200` on a download does not prove an audit row exists; the alert does that work, not the response.

### 9.1.1 Actions

One generic event shape from day one, so adding an action costs a union member rather than a migration (grooming D14).

| `action` | Written by | Outcomes |
|---|---|---|
| `document.upload` | [05-documents.md 5.2](05-documents.md) | allowed |
| `document.download` | [05-documents.md 5.9](05-documents.md) | allowed, denied |
| `document.download_bulk` | [05-documents.md 5.10](05-documents.md) | allowed, denied, one per document |
| `document.preview` | [05-documents.md 5.8](05-documents.md) | allowed |
| `document.delete` | Malware stage, soft delete | allowed |
| `document.version_add` | [05-documents.md 5.7](05-documents.md) | allowed |
| `category.create` | [06-categories.md 6.3](06-categories.md), 6.4 | allowed |
| `category.permission_change` | [06-categories.md 6.5](06-categories.md) | allowed, denied |
| `config.change` | [04-configuration.md 4.3](04-configuration.md), 4.4, [03-tenants.md 3.3](03-tenants.md) | allowed |
| `ai.override` | [06-categories.md 6.6](06-categories.md), [07-enrichment.md 7.4](07-enrichment.md), 7.5 | allowed |
| `auth.login` | [02-authentication.md 2.2](02-authentication.md) | allowed |
| `auth.logout` | [02-authentication.md 2.3](02-authentication.md) | allowed |
| `auth.login_failed` | [02-authentication.md 2.2](02-authentication.md) | denied |
| `admin.reset_state` | [10-system.md 10.4](10-system.md) | allowed |
| `malware.detected` | Pipeline scan stage | denied |
| `tenant.create` | [03-tenants.md 3.1](03-tenants.md) | allowed |
| `access.denied` | Any route refusing on a role floor or a cross-tenant id | denied |
| `search.performed` | [08-search.md 8.1](08-search.md) | allowed |

The last two are additions to the closed `audit_action` enum in [../technical-specs/06-data-model.md 6.9](../technical-specs/06-data-model.md). Without `access.denied` the audit assertion in AC-41.05 and AC-43.03 has no row to produce; without `search.performed` the search metrics in AC-12.02 have no source. Both are flagged in [01-conventions.md 1.13](01-conventions.md).

`outcome` is `allowed` or `denied`. Denials are first-class, because AC-13.02 requires them visible (module invariant 5.7.2).

## 9.2 GET /audit-events

**Signature.** `GET /api/v1/audit-events`

**Purpose.** The Audit Trail table. Triggered by the "Audit Trail" menu.

**Access.** `head_of_team`.

**Input.** Query parameters.

| field | type | required | notes |
|---|---|---|---|
| `page` | integer | no | Default 1 |
| `limit` | integer | no | Default 10, max 100 |
| `sort` | enum | no | `createdAt` only. Default `createdAt` |
| `order` | enum | no | Default `desc`, newest first |
| `q` | string | no | Substring match on actor name and subject title. Serves AC-37.02's server-side half. |
| `action` | enum, repeated | no | Any value from 9.1.1 |
| `outcome` | enum | no | `allowed` or `denied` |
| `actorId` | uuid | no | |
| `subjectId` | uuid | no | |
| `from`, `to` | timestamp | no | Inclusive range on `created_at` |

`q` exists so the Audit Trail filter still works past the first page. AC-37.02 filters the table by "Zayd" and asserts matching rows on User or Document Name; a purely client-side filter over one loaded page would silently miss rows on page 2.

**Behavior.**

1. `activity.listAudit(tenantId, filter, page)`, tenant-scoped at the data layer.
2. Resolve `actor_id` to a name. A null `actor_id` is a system action and renders as `Sistem`.
3. Resolve `subject_id` to a title where the subject still exists. A deleted document leaves its id and its `metadata.title` snapshot; the row survives the subject, which is the point of an append-only ledger.

**Output.** `200 OK`, collection envelope.

```json
{
  "data": [
    {
      "id": "10241",
      "action": "document.download",
      "actionLabel": "Unduhan ditolak",
      "outcome": "denied",
      "actor": { "id": "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", "name": "Zayd Almasi" },
      "subject": { "type": "document", "id": "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
                   "title": "offering-letter.pdf" },
      "metadata": { "categoryId": "7b2f0c93-1d84-4a6e-9b52-6c7d8e9f0a1b",
                    "reason": "DOWNLOAD_FORBIDDEN" },
      "createdAt": "2026-09-10T05:41:12.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

| field | type | nullable | notes |
|---|---|---|---|
| `id` | string | no | `bigserial` rendered as a string, so a large ledger never loses precision in JavaScript |
| `action` | enum | no | The stable English code |
| `actionLabel` | string | no | Indonesian, and outcome-aware: `document.download` with `outcome: "denied"` renders `Unduhan ditolak`, which is the exact string AC-13.02 asserts |
| `actor` | object | yes | Null for system actions |
| `subject` | object | yes | `{ type, id, title }`; `title` may be null if the subject is gone and no snapshot was kept |
| `metadata` | object | yes | Action-specific. Never contains document content or a search query string. |

`actionLabel` is served rather than mapped in the client because AC-13.02's assertion is on a rendered string, and a client-side map would put the contract in two places. The four columns AC-13.01 names, Siapa, Apa, Aksi and Kapan, are `actor.name`, `subject.title`, `actionLabel` and `createdAt`.

Empty result: `meta.message` is `Belum ada aktivitas tercatat` (AC-13.03).

**Errors.**

| code | status | condition |
|---|---|---|
| `FORBIDDEN` | 403 | Below `head_of_team` |
| `VALIDATION_ERROR` | 422 | Unknown `action`, malformed date range |

**Traceability.** AC-13.01, AC-13.02, AC-13.03, AC-37.02, AC-39.01, AC-39.02.

## 9.3 GET /analytics/dashboard

**Signature.** `GET /api/v1/analytics/dashboard`

**Purpose.** The Analitik screen. One operation returning every card, because the screen is read as a whole and three round trips would let the cards disagree about their window.

**Access.** `head_of_team`.

**Input.** None. Windows are fixed by the criteria: 7 days for volume and retrieval, 30 days for AI quality.

Fixed windows rather than a `from` and `to` parameter is deliberate. AC-12.01 through AC-12.03 each name their own window, and a caller-chosen range would make "persentase kategori saran yang diubah" mean something different per request while the card label stayed the same.

**Behavior.**

1. `activity.dashboard(tenantId)`.
2. Reads `analytics_rollups`, never raw events, so the response stays fast as the ledger grows (module invariant 5.7.5). Rollups are computed nightly and on demand.
3. A tenant with no data returns zeros, never nulls (AC-12.04).

**Output.** `200 OK`.

```json
{
  "data": {
    "volume": {
      "totalDocuments": 412,
      "uploadedLast7Days": 23
    },
    "retrieval": {
      "searchesLast7Days": 187,
      "zeroResultRatePercent": 12.3,
      "documentsOpenedLast7Days": 96
    },
    "aiQuality": {
      "categoryOverrideRatePercent": 8.1,
      "fieldOverrideRatePercent": 4.7,
      "sampleSize": 149
    },
    "generatedAt": "2026-09-10T06:00:00.000Z",
    "message": null
  }
}
```

| field | source | criterion |
|---|---|---|
| `volume.totalDocuments` | Non-deleted documents in the tenant | AC-12.01 |
| `volume.uploadedLast7Days` | `document.upload` events, 7 days | AC-12.01 |
| `retrieval.searchesLast7Days` | `search.performed` events, 7 days | AC-12.02 |
| `retrieval.zeroResultRatePercent` | `search.performed` where the recorded count was 0, over the total, 7 days | AC-12.02 |
| `retrieval.documentsOpenedLast7Days` | `document.preview` events, 7 days | AC-12.02 |
| `aiQuality.categoryOverrideRatePercent` | `ai_field_overrides` where `field = "category"`, over confirmations, 30 days | AC-12.03 |
| `aiQuality.fieldOverrideRatePercent` | `ai_field_overrides` where `field` is not `category`, over documents processed, 30 days | AC-12.03 |
| `aiQuality.sampleSize` | Denominator of the two rates | |

Percentages are numbers with one decimal, not strings and not pre-formatted. `sampleSize` is present because an override rate over four documents is not a measurement, and the card needs to be able to say so.

For a tenant with nothing recorded, every numeric field is `0` and `message` is `Belum ada aktivitas untuk ditampilkan` (AC-12.04). The zeros are real values, not placeholders, so the cards render normally alongside the message.

An AI model change invalidates the accuracy baseline these two rates establish. Model identifiers are pinned exactly for that reason ([../technical-specs/04-tech-stack.md 4.10](../technical-specs/04-tech-stack.md)); a model change is a code change and should be treated as a break in this series.

**Errors.**

| code | status | condition |
|---|---|---|
| `FORBIDDEN` | 403 | Below `head_of_team` |

**Traceability.** AC-12.01, AC-12.02, AC-12.03, AC-12.04.

## 9.4 Activity error codes

No operation-specific codes. Standard codes are in [01-conventions.md 1.8](01-conventions.md).
