# 07 — Enrichment

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

Everything the system learns about a document after it lands, and the operations that let a person correct it. Module: `enrichment` ([../technical-specs/05-module-definitions.md 5.5](../technical-specs/05-module-definitions.md)). Entities: `document_text`, `document_pages`, `document_tags`, `document_metadata`, `ai_field_overrides` ([../technical-specs/06-data-model.md 6.8](../technical-specs/06-data-model.md)).

The pipeline itself is specified once, in [../technical-specs/12-document-processing-pipeline.md](../technical-specs/12-document-processing-pipeline.md). This file cites it and does not restate its rules.

Conventions in [01-conventions.md](01-conventions.md) apply.

## 7.1 What the API does not expose

`enqueue` and `process` have no endpoint. The worker consumes BullMQ; nothing outside the worker calls `process`, and the only client-reachable path back into the queue is the manual retry in 7.6.

Consequently the pipeline is observable but not steerable. A client can read state, correct a result, and ask for a retry. It cannot reorder stages, skip the malware scan, or choose an extraction method. Stage order is scan, extract, classify, index, fixed and not configurable, because scanning first is a security property rather than an optimisation ([../technical-specs/12-document-processing-pipeline.md 12.1](../technical-specs/12-document-processing-pipeline.md)).

## 7.2 GET /documents/:id/processing

**Signature.** `GET /api/v1/documents/{id}/processing`

**Purpose.** The polling target for a document whose state is still moving. TanStack Query polls it while the upload tray shows a document as Antre or Diproses, and stops on `ready` or `failed`.

**Access.** `member`, subject to the visibility predicate in [05-documents.md 5.4.1](05-documents.md).

**Input.** Path parameter `id`.

**Behavior.** `enrichment.getState(documentId)`. A light read against `documents`, deliberately narrower than [05-documents.md 5.5](05-documents.md) so a poll every two seconds does not pull the version list and the metadata with it.

State transitions are QUEUED, then PROCESSING, then READY or FAILED, and nothing else. A transient failure retries three times with exponential backoff and the document stays PROCESSING throughout, so a poller never sees a flicker to FAILED and back (AC-44.02, module invariant 5.5.4).

**Output.** `200 OK`.

```json
{
  "data": {
    "documentId": "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
    "state": "failed",
    "label": "Gagal",
    "failureReason": { "code": "password_protected", "message": "Dokumen terproteksi password" },
    "searchable": false,
    "updatedAt": "2026-09-10T05:20:44.000Z"
  }
}
```

| field | type | nullable | notes |
|---|---|---|---|
| `state` | enum `queued`, `processing`, `ready`, `failed` | no | |
| `label` | string | no | The Indonesian label from [05-documents.md 5.1.1](05-documents.md) |
| `failureReason` | object | yes | Non-null only when `state` is `failed` |
| `searchable` | boolean | no | Whether the document's pages are in the content index. False while processing and false for `password_protected` (AC-44.04). |
| `updatedAt` | timestamp | no | |

A document deleted because malware was detected returns `404` from this operation. That `404` is how the client learns the outcome; there is no `malware` state to poll for, because the document no longer exists ([05-documents.md 5.3](05-documents.md), AC-46.02).

**Errors.**

| code | status | condition |
|---|---|---|
| `NOT_FOUND` | 404 | Unknown, other tenant, window-hidden, or deleted by the malware stage |

**Traceability.** AC-44.01, AC-44.02, AC-44.03, AC-44.04, AC-44.05, AC-46.02, AC-33.03.

## 7.3 Document metadata

Extracted author and creation date are returned inline on the document detail response, not by a separate operation ([05-documents.md 5.5](05-documents.md)):

```json
"metadata": { "author": "Sari Dewi", "documentCreatedAt": "2026-03-04T00:00:00.000Z" }
```

| field | type | nullable | source | criterion |
|---|---|---|---|---|
| `author` | string | yes | `document_metadata.author` | AC-04.01 |
| `documentCreatedAt` | timestamp | yes | `document_metadata.document_created_at`, extracted from the file, never the upload time | AC-04.01 |

Both are null when extraction found nothing. The client renders `Tidak diketahui` for a null author, and the document remains openable and searchable (AC-04.02). The server sends `null` rather than the Indonesian placeholder, because `null` and the string "Tidak diketahui" are different facts and only one of them can be corrected in 7.4.

There is no separate metadata endpoint. Adding one would give the detail page two sources for the same panel.

## 7.4 PATCH /documents/:id/fields

**Signature.** `PATCH /api/v1/documents/{id}/fields`

**Purpose.** Correct a value the AI produced. Triggered by clicking a field on the detail page, editing it, and saving.

**Access.** `member` for a document they uploaded; `head_of_team` and above for any document in the tenant (AC-47.03, AC-47.04).

**Input.** Path parameter `id`. JSON body: a partial map of correctable fields. At least one key is required.

| field | type | required | notes |
|---|---|---|---|
| `documentType` | string, nullable | no | `document_classification.document_type` (AC-06.02) |
| `author` | string, nullable | no | `document_metadata.author` |
| `documentCreatedAt` | timestamp, nullable | no | `document_metadata.document_created_at` |
| `extractedFields` | object | no | Corrections keyed by extracted field name, for example `"Total Nilai"` (AC-47.01) |

```json
{ "documentType": "Invoice", "extractedFields": { "Nama Vendor": "PT Sumber Makmur" } }
```

Category is not corrected here. It has its own operation with its own confirmation semantics ([06-categories.md 6.6](06-categories.md)), because changing a category also clears the "Saran" marker and removes the document from the upload tray, which no other field does. Tags are not corrected here either; see 7.5.

The `ai_field` enum in [../technical-specs/06-data-model.md 6.8](../technical-specs/06-data-model.md) is `category`, `document_type`, `tag`, `author`, `extracted_field`. This operation writes `document_type`, `author` and `extracted_field`.

**Behavior.**

1. Resolve the document. Unknown, other tenant, or window-hidden: `404`.
2. Ownership: `NOT_OWNER` unless the caller uploaded it or is `head_of_team` or above (AC-47.03).
3. For each supplied key, `enrichment.overrideField(documentId, field, value, actor)`.
4. Write one `ai_field_overrides` row per changed field, carrying `original_value` (what the AI said) and `new_value`. `original_value` is written once and never overwritten by a later correction of the same field. Without it AC-12.03 has nothing to measure (module invariant 5.5.8).
5. Write one `ai.override` audit event per changed field, carrying the actor and the timestamp (AC-47.01, AC-47.04).
6. Reindex the document if `author` or `documentType` changed, because both are searchable fields ([../technical-specs/13-search-indexing-strategy.md 13.2](../technical-specs/13-search-indexing-strategy.md)).

Sending a key whose value already matches is a no-op: no override row, no audit event. Recording a correction that corrected nothing would inflate the AC-12.03 override rate with non-events.

Setting a field to `null` is a correction, not an omission. `{"author": null}` clears the author and records an override; leaving `author` out of the body leaves it alone.

**Output.** `200 OK`, the document detail shape from [05-documents.md 5.5](05-documents.md), so the page re-renders from one payload.

**Errors.**

| code | status | condition | message |
|---|---|---|---|
| `NOT_OWNER` | 403 | Not the uploader and below `head_of_team` (AC-47.03) | `Anda hanya dapat mengubah dokumen milik Anda` |
| `NOT_FOUND` | 404 | Unknown, other tenant, or window-hidden | Standard |
| `VALIDATION_ERROR` | 422 | Empty body, unknown key, malformed timestamp | Per field |

**Traceability.** AC-47.01, AC-47.03, AC-47.04, AC-12.03, AC-06.02.

## 7.5 PUT /documents/:id/tags

**Signature.** `PUT /api/v1/documents/{id}/tags`

**Purpose.** Replace a document's tag set. Triggered by removing a tag and adding another on the detail page.

**Access.** As 7.4.

`PUT` with the whole set, not `POST` and `DELETE` per tag. AC-47.02 is one user action, "hapus Legal, tambah Finance", and the three-tag cap is a property of the set. Two granular operations would make the cap enforceable only across a sequence of requests, which means a client could sit at four tags between them.

**Input.** Path parameter `id`. JSON body.

| field | type | required | notes |
|---|---|---|---|
| `tags` | array of string | yes | 0 to 3 entries. Trimmed, lowercased, deduplicated. `citext` at rest. |

```json
{ "tags": ["strategy", "finance"] }
```

**Behavior.**

1. Resolve the document and apply the ownership check as in 7.4.
2. Reject more than three with `TOO_MANY_TAGS`. The cap is the same one the pipeline enforces at write time when the AI returns five (AC-05.05, module invariant 5.5.7).
3. Replace `document_tags` for the document in one transaction. Tags the user supplied are stored with `source = "user"`; a tag that survives from the AI set keeps `source = "ai"` and its confidence, so a user editing one tag does not relabel the rest as human-authored and quietly change what AC-12.03 measures.
4. Write one `ai_field_overrides` row with `field = "tag"`, `original_value` the AI tag set as a sorted comma-joined string, `new_value` the new set, plus one `ai.override` audit event. One row per edit, not per tag, because the correction is to the set.
5. Reindex the document and invalidate the cached Top Tags aggregation, so the panel in 7.7 reflects the change (AC-47.02).

An empty array is valid and clears every tag.

**Output.** `200 OK`, the document detail shape.

**Errors.**

| code | status | condition | message |
|---|---|---|---|
| `TOO_MANY_TAGS` | 422 | More than three (AC-05.05) | `Maksimal 3 tag per dokumen` |
| `NOT_OWNER` | 403 | Not the uploader and below `head_of_team` | `Anda hanya dapat mengubah dokumen milik Anda` |
| `NOT_FOUND` | 404 | Unknown, other tenant, or window-hidden | Standard |
| `VALIDATION_ERROR` | 422 | Non-string entries, empty strings, over-length tags | Per field |

**Traceability.** AC-47.02, AC-05.05.

## 7.6 POST /documents/:id/reprocess

**Signature.** `POST /api/v1/documents/{id}/reprocess`

**Purpose.** Send a FAILED document back through the pipeline. The manual retry edge in the state machine.

**Access.** `head_of_team`. A failure is usually a corpus problem rather than a personal one, and a member repeatedly retrying a password-protected PDF burns AI budget for a result that cannot change.

**Input.** Path parameter `id`. No body.

**Behavior.**

1. Resolve the document. Unknown or other tenant: `404`.
2. Permit only from `failed` or `ready`. The state machine has `FAILED -> QUEUED` and `READY -> QUEUED`, and no edge out of `queued` or `processing` ([../technical-specs/12-document-processing-pipeline.md 12.2](../technical-specs/12-document-processing-pipeline.md)). Calling it on a document already in flight returns `INVALID_STATE_TRANSITION` rather than enqueuing a second job.
3. Clear derived data, set state to `queued`, `enrichment.enqueue(documentId)`.
4. `process` is idempotent and every stage is individually re-runnable, so a redelivered job for a document that finished in the meantime is a no-op (module invariant 5.5.3).

**Output.** `202 Accepted`.

```json
{ "data": { "documentId": "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01", "state": "queued", "label": "Antre" } }
```

**Errors.**

| code | status | condition | message |
|---|---|---|---|
| `INVALID_STATE_TRANSITION` | 409 | Current state is `queued` or `processing` | `Dokumen sedang diproses` |
| `NOT_FOUND` | 404 | Unknown or other tenant | Standard |
| `FORBIDDEN` | 403 | Below `head_of_team` | Standard |

**Traceability.** [../technical-specs/06-data-model.md 6.10.1](../technical-specs/06-data-model.md), AC-44.03.

## 7.7 GET /tags/top

**Signature.** `GET /api/v1/tags/top`

**Purpose.** The "Top Tags" filter panel above the document list.

**Access.** `member`.

**Input.** Query parameters.

| field | type | required | notes |
|---|---|---|---|
| `limit` | integer | no | Default 10, max 50. AC-05.01 shows 10. |

**Behavior.** `enrichment.topTags(tenantId, limit)`. Aggregates `document_tags` by `(tenant_id, tag)`, ordered by document count descending, and is cached in Valkey. The cache is invalidated by 7.5 and by the pipeline's tag write, so an edit is visible on the next read (AC-47.02).

The aggregation counts documents the caller can see. A tag carried only by documents inside another uploader's confirmation window does not appear, which keeps the panel from advertising the existence of work a colleague has not confirmed yet.

**Output.** `200 OK`.

```json
{
  "data": [
    { "tag": "strategy", "documentCount": 42 },
    { "tag": "legal", "documentCount": 31 }
  ],
  "meta": { "total": 2 }
}
```

Ordered by `documentCount` descending, which is what AC-05.01 asserts. Ties break on `tag` ascending so the panel does not reshuffle between reads.

Clicking a tag applies `GET /documents?tags=...` ([05-documents.md 5.4](05-documents.md)); the filtering itself is not this operation's job.

**Errors.** None specific.

**Traceability.** AC-05.01, AC-05.02, AC-05.03.

## 7.8 Enrichment error codes

| code | status | condition | message |
|---|---|---|---|
| `TOO_MANY_TAGS` | 422 | More than three tags submitted | `Maksimal 3 tag per dokumen` |
| `INVALID_STATE_TRANSITION` | 409 | Reprocess requested on a document in flight | `Dokumen sedang diproses` |
| `NOT_OWNER` | 403 | Correction on someone else's document below `head_of_team` | `Anda hanya dapat mengubah dokumen milik Anda` |

Standard codes are in [01-conventions.md 1.8](01-conventions.md).
