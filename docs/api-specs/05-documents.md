# 05 — Documents

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

The document itself: its bytes, its versions, its identity, and getting it back out. Module: `catalog` ([../technical-specs/05-module-definitions.md 5.3](../technical-specs/05-module-definitions.md)). Entities: `documents`, `document_versions` ([../technical-specs/06-data-model.md 6.5](../technical-specs/06-data-model.md)).

Conventions in [01-conventions.md](01-conventions.md) apply. This is the largest surface in the set and the one every other resource file points at.

## 5.1 Document resource shape

Returned by list and detail. Detail carries the extra objects marked "detail only".

| field | type | nullable | source |
|---|---|---|---|
| `id` | uuid | no | `documents.id` |
| `title` | string | no | `documents.title`, defaults to the original filename |
| `filename` | string | no | Current version's `filename` |
| `mimeType` | string | no | Current version's `mime_type` |
| `fileType` | enum `pdf`, `docx`, `xlsx`, `txt` | no | Derived from `mime_type`, drives the card icon (AC-38.01) |
| `sizeBytes` | integer | no | Current version's `size_bytes` |
| `pageCount` | integer | yes | Null until extraction completes |
| `versionNumber` | integer | no | Current version's `version_number` |
| `versionCount` | integer | no | Number of versions |
| `processingState` | enum `queued`, `processing`, `ready`, `failed` | no | `documents.processing_state` |
| `processingLabel` | string | no | Indonesian label, see 5.1.1 |
| `failureReason` | object | yes | `{ code, message }`, non-null only when `processingState` is `failed` |
| `uploader` | object | no | `{ id, name }` (AC-38.01) |
| `category` | object | yes | `{ id, name, isSuggestion, isSystem }`, see [06-categories.md](06-categories.md) |
| `documentType` | string | yes | `document_classification.document_type`, "Invoice" (AC-06.02) |
| `tags` | array of string | no | At most 3 (AC-05.05) |
| `downloadAllowed` | boolean | no | Current value of `classification.canDownloadCategory` |
| `createdAt` | timestamp | no | `documents.created_at`, the "tanggal unggah" |
| `metadata` | object | yes | Detail only. `{ author, documentCreatedAt }`, see [07-enrichment.md](07-enrichment.md) |
| `versions` | array | no | Detail only. See 5.6. |

`downloadAllowed` is a convenience for rendering the disabled Download control in AC-10.02. It is never the control itself: 5.9 re-evaluates the predicate server-side on every request, which is what AC-10.03 tests.

### 5.1.1 Processing labels

`processingLabel` is served, not derived in the client, so the four strings AC-44.01 enumerates have one source.

| `processingState` | `processingLabel` |
|---|---|
| `queued` | `Antre` |
| `processing` | `Diproses` |
| `ready` | `Siap` |
| `failed` | `Gagal` |

`failureReason.message` per [../technical-specs/06-data-model.md 6.10.1](../technical-specs/06-data-model.md):

| `code` | `message` | Criterion |
|---|---|---|
| `password_protected` | `Dokumen terproteksi password` | AC-44.04 |
| `unreadable_content` | `Isi dokumen tidak dapat dibaca` | AC-44.05 |
| `extraction_timeout` | `Proses ekstraksi melebihi batas waktu` | |
| `ai_unavailable` | `Layanan AI tidak tersedia` | |
| `index_failed` | `Dokumen gagal diindeks` | |

A FAILED document remains listed, previewable where possible, and downloadable subject to its category permission. Failure removes derived data, never the document (AC-44.03, [../technical-specs/12-document-processing-pipeline.md 12.1](../technical-specs/12-document-processing-pipeline.md)).

## 5.2 POST /documents

**Signature.** `POST /api/v1/documents`

**Purpose.** Accept one to twenty files, store them, and enqueue processing. Triggered by dropping files on the upload area.

**Access.** `member`.

**Input.** `multipart/form-data`.

| part | type | required | notes |
|---|---|---|---|
| `files` | file, repeated | yes | 1 to 20 parts. Order is preserved in the response. |

Per-file constraints, each evaluated against the file rather than the batch:

| Constraint | Source | Failure |
|---|---|---|
| Type in PDF, DOCX, XLSX, TXT | Magic-byte sniff, never the extension or the client MIME type ([../technical-specs/07-security.md 7.5](../technical-specs/07-security.md)) | `UNSUPPORTED_TYPE` |
| Size at or below `max_file_size_mb` | [04-configuration.md 4.1](04-configuration.md) | `FILE_TOO_LARGE` |
| Content hash not already present in the tenant | `UNIQUE (tenant_id, content_hash)` | `DUPLICATE_CONTENT` |
| Remaining quota sufficient | `tenancy.reserveQuota` | `QUOTA_EXCEEDED` |

**Behavior.**

1. Reject the whole request with `BATCH_TOO_LARGE` if more than 20 parts arrive. Nothing is stored (AC-01.05). This is the one batch-level failure; every other rejection is per file.
2. Resolve the session before reading any byte. Expired: `401`, nothing stored (AC-01.08).
3. For each file in order, run `catalog.upload`:
   a. Sniff the type. Reject unsupported (AC-01.03).
   b. Check size against the tenant's current limit (AC-01.06).
   c. `tenancy.reserveQuota(tenantId, sizeBytes)`. Refused: `QUOTA_EXCEEDED` (AC-35.03).
   d. Stream to the blob store at `t/<tenant>/d/<document>/v/<version>`, computing SHA-256 as it streams.
   e. Insert `documents` and `document_versions` version 1. A duplicate hash loses on insert, not on a read-then-check (AC-03.01, AC-03.04).
   f. `commitQuota` on success, `releaseQuota` on any failure.
   g. `enrichment.enqueue(documentId)`. State is `queued`.
   h. Write a `document.upload` audit event.
4. A filename matching an existing document is not a duplicate and never a new version. It becomes a separate document (AC-03.03, matrix in [../technical-specs/06-data-model.md 6.6](../technical-specs/06-data-model.md)).
5. A connection that drops mid-stream releases the reservation and stores nothing. No partial document appears and no quota is consumed (AC-01.07).

Files are processed sequentially, not in parallel, so AC-35.04's "first two succeed, third is refused" is deterministic rather than a function of which stream finished first.

**Output.** `201 Created` when at least one file was accepted, `422` when none were.

```json
{
  "data": {
    "accepted": 2,
    "rejected": 1,
    "summary": "2 dari 3 file berhasil diunggah",
    "results": [
      {
        "index": 0, "filename": "laporan-q3.pdf", "status": "accepted",
        "document": { "id": "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01", "title": "laporan-q3.pdf",
                      "processingState": "queued", "processingLabel": "Antre" }
      },
      {
        "index": 1, "filename": "presentasi-baru.pdf", "status": "accepted",
        "document": { "id": "3c7e5b21-9a04-4d18-b6f2-8e0a1c2d3e4f", "title": "presentasi-baru.pdf",
                      "processingState": "queued", "processingLabel": "Antre" }
      },
      {
        "index": 2, "filename": "arsip-lama.pdf", "status": "rejected",
        "error": {
          "code": "QUOTA_EXCEEDED",
          "message": "Kapasitas penyimpanan penuh"
        }
      }
    ]
  }
}
```

| field | type | notes |
|---|---|---|
| `accepted` | integer | Count of stored documents |
| `rejected` | integer | Count of per-file refusals |
| `summary` | string, nullable | Present only on a mixed batch. `2 dari 3 file berhasil diunggah` (AC-35.04). Null when every file succeeded or every file failed. |
| `results[].index` | integer | Position in the submitted `files` array |
| `results[].status` | enum `accepted`, `rejected` | |
| `results[].document` | object | Accepted only. Minimal shape; the client polls for the rest. |
| `results[].error` | object | Rejected only. Standard error object. |
| `results[].error.existingDocumentId` | uuid | `DUPLICATE_CONTENT` only. The link AC-03.01 requires the message to carry. |

A single accepted file yields `accepted: 1`, one result, and the client shows `File diterima untuk diproses` (AC-01.01, AC-03.02). Three accepted files yield three success notifications (AC-01.04).

Returning `201` with per-file outcomes rather than failing the batch is the deep choice here. The alternative pushes the 20-file cap, the ordering and the partial-quota story into every client, and AC-35.04 then depends on client behaviour rather than on the server.

**Errors.** Batch level:

| code | status | condition | message |
|---|---|---|---|
| `BATCH_TOO_LARGE` | 422 | More than 20 parts (AC-01.05) | `Maksimal 20 file per unggahan` |
| `VALIDATION_ERROR` | 422 | No `files` part at all | Per field |
| `SESSION_EXPIRED` | 401 | Session ended mid-upload (AC-01.08) | `Sesi Anda telah berakhir. Silakan login kembali` |
| `UPLOAD_INTERRUPTED` | 400 | Stream truncated (AC-01.07) | `Unggahan terputus. Silakan coba lagi` |
| `PAYLOAD_TOO_LARGE` | 413 | Transport cap hit before the handler could type it | Standard |
| `RATE_LIMITED` | 429 | More than 100 uploads in an hour | Standard |

Per file, inside `results[].error`:

| code | condition | message |
|---|---|---|
| `UNSUPPORTED_TYPE` | Magic bytes not PDF, DOCX, XLSX or TXT (AC-01.03) | `Tipe file tidak didukung. Tipe yang diterima: PDF, DOCX, XLSX, TXT` |
| `FILE_TOO_LARGE` | Above `max_file_size_mb` (AC-01.06) | `Ukuran file melebihi batas 20 MB`, interpolated with the tenant's current limit |
| `QUOTA_EXCEEDED` | Reservation refused (AC-35.03, AC-35.04) | `Kapasitas penyimpanan penuh` |
| `DUPLICATE_CONTENT` | Hash already in the tenant (AC-03.01, AC-03.04) | `File ini sudah ada di sistem` |

Malware is not decided here. Scanning happens in the worker, after the response. See 5.3.

**Traceability.** AC-01.01 through AC-01.08, AC-03.01 through AC-03.04, AC-35.03, AC-35.04, AC-38.01.

## 5.3 Malware is not an upload error

AC-46.02 requires an infected file to be refused and never reachable, but scanning is the first stage of the worker pipeline, not a step in the request ([../technical-specs/12-document-processing-pipeline.md 12.1](../technical-specs/12-document-processing-pipeline.md)). The upload therefore returns `201` and the document appears as `queued`.

When the scanner reports an infection, the worker deletes the blob and the document row and writes a `malware.detected` audit event. Malware is not a processing state; there is no `failed` document to inspect afterwards.

The client learns of it by polling ([07-enrichment.md 7.2](07-enrichment.md)): the document id stops resolving, `GET /documents/:id` returns `404`, and the upload tray replaces the row with `File terdeteksi mengandung malware dan tidak dapat diunggah`. Between the `201` and the scan result the document is visible to its uploader only, which is what AC-46.01's "dapat diakses sesuai aturan visibilitas" and AC-46.02's "tidak pernah dapat diakses oleh pengguna lain" together require.

## 5.4 GET /documents

**Signature.** `GET /api/v1/documents`

**Purpose.** The document list and the dashboard card grid. Also serves the category filter (US-34) and the tag filter (US-05).

**Access.** `member`. Results are scoped by the confirmation-window predicate in 5.4.1.

**Input.** Query parameters.

| field | type | required | notes |
|---|---|---|---|
| `page` | integer | no | Default 1 |
| `limit` | integer | no | Default 10, max 100 |
| `sort` | enum | no | `createdAt`, `title`, `sizeBytes`. Default `createdAt` |
| `order` | enum | no | Default `desc` |
| `categoryId` | uuid | no | Single category. Omit for all categories (AC-34.02). |
| `tags` | string, repeated | no | Repeat the parameter per tag. Multiple tags are conjunctive: a document must carry every one (AC-05.03). |
| `state` | enum, repeated | no | Filter by `processingState` |
| `unconfirmedOnly` | boolean | no | The "UPLOADED DOCUMENT" tray. See [06-categories.md 6.7](06-categories.md). |
| `uploaderId` | uuid | no | |

`?tags=Strategy&tags=Legal` is AND, not OR. AC-05.03 says "Strategy DAN Legal", and an OR default would silently return a superset of what the highlighted chips claim.

**Behavior.**

1. Apply the tenant filter at the data layer. A query without it does not typecheck ([../technical-specs/07-security.md 7.3](../technical-specs/07-security.md)).
2. Apply the visibility predicate in 5.4.1.
3. Apply filters, sort, paginate.
4. Select `meta.message` when the result is empty, per [01-conventions.md 1.5.1](01-conventions.md): the tenant-has-no-documents message differs from the filter-matched-nothing messages, and a category filter's empty message differs from a tag filter's.

**Output.** `200 OK`, collection of the shape in 5.1 without the detail-only fields.

**Errors.**

| code | status | condition |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Unknown `sort` field, `limit` above 100, malformed uuid |

**Traceability.** AC-01.02, AC-38.01, AC-38.03, AC-34.01, AC-34.02, AC-34.03, AC-05.02, AC-05.03, AC-05.04, AC-39.01, AC-39.02, AC-39.03, AC-44.01.

### 5.4.1 The confirmation window predicate

An unconfirmed document is visible to its uploader alone until `pending_confirmation_days` have passed since upload; after that, or once confirmed, it is visible to the whole tenant. `head_of_team` and above bypass the window entirely (grooming D4, module invariant 5.4.4).

```
visible(doc, viewer) :=
     viewer.role >= head_of_team
  OR doc.confirmed_at IS NOT NULL
  OR doc.uploader_id = viewer.id
  OR doc.created_at + pending_confirmation_days < now()
```

There is no stored state for the window and no sweeper. `SUGGESTED` and `VISIBLE_UNCONFIRMED` are the same row differing only by an age predicate ([../technical-specs/06-data-model.md 6.10.2](../technical-specs/06-data-model.md)), so no document can be stranded by a job that failed to run.

The predicate applies identically to list, detail, search and related. A document hidden by it returns `404` on direct access, not `403`: inside the tenant the row exists, but confirming its existence to a colleague who may not see it yet defeats the window.

**Traceability.** AC-02.05, AC-02.06, AC-02.07.

## 5.5 GET /documents/:id

**Signature.** `GET /api/v1/documents/{id}`

**Purpose.** The document detail page: metadata, extracted fields, preview target, related documents. Triggered by clicking a card (AC-38.02) or a search result.

**Access.** `member`, subject to 5.4.1.

**Input.** Path parameter `id` (uuid).

**Behavior.**

1. `catalog.getDocument(tenantId, id)`.
2. A document in another tenant returns `404`, never `403`. `getDocument` returns `NotFound` for it by construction (module invariant 5.3.8), so the handler cannot leak existence even by accident.
3. A denied cross-tenant attempt writes an `access.denied` audit event against the caller's own tenant, with the attempted id in `metadata`. Recording it against the victim tenant would place one tenant's attacker in another tenant's ledger.

**Output.** `200 OK`, the full shape in 5.1 including `metadata` and `versions`.

```json
{
  "data": {
    "id": "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
    "title": "kontrak-kerjasama.pdf",
    "filename": "kontrak-kerjasama.pdf",
    "mimeType": "application/pdf",
    "fileType": "pdf",
    "sizeBytes": 2411520,
    "pageCount": 42,
    "versionNumber": 2,
    "versionCount": 2,
    "processingState": "ready",
    "processingLabel": "Siap",
    "failureReason": null,
    "uploader": { "id": "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", "name": "Budi Santoso" },
    "category": { "id": "7b2f0c93-1d84-4a6e-9b52-6c7d8e9f0a1b", "name": "Technical Spec",
                  "isSuggestion": false, "isSystem": false },
    "documentType": "Kontrak",
    "tags": ["legal", "kerjasama", "2026"],
    "downloadAllowed": true,
    "metadata": { "author": "Sari Dewi", "documentCreatedAt": "2026-03-04T00:00:00.000Z" },
    "versions": [
      { "id": "aa11b2c3-4d5e-4f60-8a1b-2c3d4e5f6071", "versionNumber": 2,
        "filename": "kontrak-kerjasama-rev.pdf", "sizeBytes": 2411520, "pageCount": 42,
        "uploadedBy": { "id": "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", "name": "Budi Santoso" },
        "createdAt": "2026-09-09T10:15:00.000Z", "isCurrent": true },
      { "id": "bb22c3d4-5e6f-4071-9b2c-3d4e5f607182", "versionNumber": 1,
        "filename": "kontrak-kerjasama.pdf", "sizeBytes": 2402304, "pageCount": 41,
        "uploadedBy": { "id": "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", "name": "Budi Santoso" },
        "createdAt": "2026-09-01T09:00:00.000Z", "isCurrent": false }
    ],
    "createdAt": "2026-09-01T09:00:00.000Z"
  }
}
```

`metadata.author` is null when extraction found none; the client renders `Tidak diketahui` (AC-04.02). The document is still openable and still searchable in that case.

**Errors.**

| code | status | condition |
|---|---|---|
| `NOT_FOUND` | 404 | Unknown id, soft-deleted, another tenant (AC-43.03), or hidden by the confirmation window (AC-02.05) |

**Traceability.** AC-38.02, AC-04.01, AC-04.02, AC-43.03, AC-02.05.

## 5.6 GET /documents/:id/versions

**Signature.** `GET /api/v1/documents/{id}/versions`

**Purpose.** Populate the version picker. Also returned inline by 5.5; this operation exists so the picker can refresh without refetching the whole document.

**Access.** `member`, subject to 5.4.1.

**Input.** Path parameter `id`.

**Behavior.** `catalog.listVersions(documentId)`, newest first.

**Output.** `200 OK`, the `versions` array from 5.5 in a collection envelope.

**Errors.** `NOT_FOUND` as 5.5.

**Traceability.** AC-21.02.

## 5.7 POST /documents/:id/versions

**Signature.** `POST /api/v1/documents/{id}/versions`

**Purpose.** Add a revision to a named document. Triggered by "Unggah Versi Baru" on the detail page.

**Access.** `member`. Any member of the tenant may add a version; the ownership condition that governs AI-field correction does not apply here, and no criterion restricts it.

**Input.** Path parameter `id`. `multipart/form-data` with exactly one `file` part.

**Behavior.**

1. Resolve the document. Unknown, other tenant, or window-hidden: `404`.
2. Same type and size validation as 5.2.
3. `tenancy.reserveQuota`, then stream and hash.
4. If the content hash equals the current version's, reject with `IDENTICAL_CONTENT` and create nothing (AC-21.03).
5. Allocate `version_number` under `SELECT ... FOR UPDATE` on the parent document row. Consecutive integers per document, no gap and no duplicate under concurrency (AC-21.04, module invariant 5.3.3).
6. Insert the version, repoint `documents.current_version_id`, commit the quota.
7. Remove the previous version's pages from the index and enqueue the new version. Each version is processed independently: a new version never invalidates the old version's extracted text ([../technical-specs/12-document-processing-pipeline.md 12.1](../technical-specs/12-document-processing-pipeline.md)).
8. Write a `document.version_add` audit event.

There is no implicit path from `POST /documents` to a new version. A new version exists only through this operation against a named document (module invariant 5.3.2). That is what makes AC-03.03 unambiguous: a same-named file uploaded to the dashboard is a separate document, never a silent revision of someone else's work.

A duplicate hash matching a version of a different document is still `DUPLICATE_CONTENT`, because `UNIQUE (tenant_id, content_hash)` spans the tenant, not the document.

**Output.** `201 Created`, the document in the shape of 5.5 with `versionNumber` incremented. The list still shows one row for the document (AC-21.01).

**Errors.**

| code | status | condition | message |
|---|---|---|---|
| `IDENTICAL_CONTENT` | 409 | Hash equals the current version (AC-21.03) | `Isi file sama dengan versi yang sudah ada` |
| `DUPLICATE_CONTENT` | 409 | Hash exists elsewhere in the tenant | `File ini sudah ada di sistem` |
| `UNSUPPORTED_TYPE` | 422 | Failed the magic-byte sniff | As 5.2 |
| `FILE_TOO_LARGE` | 422 | Above the limit | As 5.2 |
| `QUOTA_EXCEEDED` | 422 | Reservation refused | As 5.2 |
| `NOT_FOUND` | 404 | Unknown document | Standard |

**Traceability.** AC-21.01, AC-21.03, AC-21.04. Matrix: [../technical-specs/06-data-model.md 6.6](../technical-specs/06-data-model.md).

## 5.8 GET /documents/:id/preview

**Signature.** `GET /api/v1/documents/{id}/preview`

**Purpose.** Stream renderable bytes to the viewer without downloading. Triggered by opening a document.

**Access.** `member`, subject to 5.4.1. Preview is not gated by the category download permission. AC-10.02 disables Download on an Inactive category while the user is standing on the preview page, so the preview must be reachable there.

**Input.** Path parameter `id`. Query parameter `versionId` (uuid, optional, defaults to the current version).

**Behavior.**

1. Resolve the document and version.
2. PDF: stream the stored blob with `Content-Type: application/pdf`. The client renders it with `pdf.js`; the browser never executes document content (AC-09.01).
3. DOCX, XLSX, TXT: `catalog.renderPreview` converts through Gotenberg and streams the result as `application/pdf` (AC-09.02).
4. A conversion failure, or a document whose state is `failed` with `unreadable_content`, returns `PREVIEW_UNAVAILABLE`. The viewer shows the message and the Download control stays usable subject to the category permission (AC-09.03, AC-44.03).
5. Write a `document.preview` audit event. This event is also the source for the "dokumen yang dibuka" metric in AC-12.02.

Response headers: `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`.

**Output.** `200 OK`, a byte stream. Not a JSON envelope.

**Errors.**

| code | status | condition | message |
|---|---|---|---|
| `PREVIEW_UNAVAILABLE` | 422 | Conversion failed, or content unreadable (AC-09.03) | `Preview tidak tersedia untuk dokumen ini` |
| `NOT_FOUND` | 404 | Unknown document or version | Standard |
| `SERVICE_UNAVAILABLE` | 503 | Gotenberg unreachable | Standard |

**Traceability.** AC-09.01, AC-09.02, AC-09.03, AC-33.02, AC-44.03.

## 5.9 POST /documents/:id/download

**Signature.** `POST /api/v1/documents/{id}/download`

**Purpose.** Stream the original file to the caller and record the access. Triggered by the "Download" button.

**Access.** `member`, and `classification.canDownloadCategory(tenantId, categoryId)` must be true right now.

The verb is `POST`, not `GET`. The operation is not safe: it writes an audit row on every outcome, and it must be covered by the origin check applied to mutating requests ([../technical-specs/07-security.md 7.4](../technical-specs/07-security.md)). AC-10.03's "akses endpoint secara langsung" is refused the same way regardless of verb.

**Input.** Path parameter `id`. Optional header `Idempotency-Key` ([01-conventions.md 1.9](01-conventions.md)). JSON body, optional.

| field | type | required | notes |
|---|---|---|---|
| `versionId` | uuid | no | Defaults to the current version. AC-21.02 downloads v1 from the picker. |

**Behavior.**

1. Resolve the document. Other tenant: `404`, no file, denied event recorded (AC-43.04).
2. Read the category permission from current state, never a cache with a TTL. AC-14.02 says "sejak saat itu" (module invariant 5.4.5).
3. Refused: `403 DOWNLOAD_FORBIDDEN`, no bytes, and a `document.download` audit event with `outcome = "denied"` (AC-10.03, AC-13.02).
4. Allowed: stream the blob through the API. There are no pre-signed URLs. The object store cannot consult a category permission or write to the ledger, so a pre-signed URL would make AC-10.03 and AC-13.02 unenforceable ([../technical-specs/07-security.md 7.5](../technical-specs/07-security.md)).
5. Write one `document.download` event with `outcome = "allowed"`, deduplicated on `Idempotency-Key` within 60 seconds (AC-10.04).

A FAILED document is downloadable. Failure removed derived data, not the bytes (AC-44.03, AC-44.04).

Response headers: `Content-Disposition: attachment; filename="..."` with the filename sanitised, `Content-Type` the stored `mime_type`, `X-Content-Type-Options: nosniff`.

**Output.** `200 OK`, a byte stream in the original format (AC-10.01).

**Errors.**

| code | status | condition | message |
|---|---|---|---|
| `DOWNLOAD_FORBIDDEN` | 403 | Category `download_active` is false (AC-10.02, AC-10.03) | `Kategori ini tidak diizinkan untuk diunduh` |
| `NOT_FOUND` | 404 | Unknown document, other tenant (AC-43.04), or window-hidden | Standard |

**Traceability.** AC-10.01, AC-10.02, AC-10.03, AC-10.04, AC-13.02, AC-21.02, AC-43.04, AC-44.03.

## 5.10 POST /documents/download-bulk

**Signature.** `POST /api/v1/documents/download-bulk`

**Purpose.** Package a selection into one archive, omitting what the caller may not have. Triggered by "Download Selected".

**Access.** `member`, evaluated per document.

**Input.** JSON body.

| field | type | required | notes |
|---|---|---|---|
| `documentIds` | array of uuid | yes | 1 to 50 entries, unique |

**Behavior.**

1. Reject more than 50 with `TOO_MANY_SELECTED`. No archive is created (AC-11.03).
2. For each id: resolve within the tenant, apply 5.4.1, then evaluate the category permission.
3. Omit what is refused. Never fail the whole request because one member of the selection is restricted (module invariant 5.3.7, AC-11.02).
4. Write one `document.download_bulk` audit event per included document with `outcome = "allowed"`, and one per omitted document with `outcome = "denied"`. AC-11.01 expects three records for three files; AC-11.02 expects two for the two that were included.
5. Return a ticket. The archive is fetched by 5.11.

Two round trips rather than one streamed zip is deliberate. The Indonesian message in AC-11.02 has to travel with the outcome, and a `Content-Type: application/zip` response has nowhere to put it that is not a header the client must reassemble into prose. The ticket carries the message; the stream carries the bytes.

**Output.** `200 OK`.

```json
{
  "data": {
    "ticketId": "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b",
    "downloadUrl": "/api/v1/documents/download-bulk/e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b",
    "expiresAt": "2026-09-10T04:35:00.000Z",
    "includedCount": 2,
    "omittedCount": 1,
    "omitted": [
      { "documentId": "3c7e5b21-9a04-4d18-b6f2-8e0a1c2d3e4f",
        "title": "offering-letter.pdf", "reason": "DOWNLOAD_FORBIDDEN" }
    ],
    "message": "1 dokumen tidak diizinkan untuk diunduh dan tidak disertakan"
  }
}
```

`message` is null when nothing was omitted. It is pluralised server-side and interpolated with `omittedCount`.

A ticket is single-tenant, single-principal and expires in 5 minutes. Permission was evaluated and audited at ticket creation, so 5.11 performs no further permission work; that is what keeps the audit count equal to the file count rather than doubling it.

If every selected document is refused, the response is still `200` with `includedCount: 0` and no `downloadUrl`. The selection was valid; the outcome was empty.

**Errors.**

| code | status | condition | message |
|---|---|---|---|
| `TOO_MANY_SELECTED` | 422 | More than 50 ids (AC-11.03) | `Maksimal 50 dokumen per unduhan massal` |
| `VALIDATION_ERROR` | 422 | Empty array, duplicate or malformed ids | Per field |

Unknown or cross-tenant ids are omitted with `reason: "NOT_FOUND"` rather than failing the request, so a stale selection does not block a legitimate download.

**Traceability.** AC-11.01, AC-11.02, AC-11.03, AC-13.02.

## 5.11 GET /documents/download-bulk/:ticketId

**Signature.** `GET /api/v1/documents/download-bulk/{ticketId}`

**Purpose.** Stream the archive a ticket describes.

**Access.** The principal who created the ticket. Any other principal, including a colleague in the same tenant, receives `404`.

**Input.** Path parameter `ticketId`.

**Behavior.** Streams a zip built from the ticket's included documents. No permission is re-evaluated and no audit row is written; both happened at 5.10. An expired or already-consumed ticket returns `404`.

Response headers: `Content-Type: application/zip`, `Content-Disposition: attachment; filename="archiva-documents-<timestamp>.zip"`.

**Output.** `200 OK`, a zip stream (AC-11.01).

**Errors.**

| code | status | condition |
|---|---|---|
| `NOT_FOUND` | 404 | Unknown, expired, consumed, or another principal's ticket |

**Traceability.** AC-11.01, AC-11.02.

## 5.12 Related documents

`GET /documents/:id/related` belongs to the `search` module and is specified in [08-search.md 8.4](08-search.md). It is reached from the document detail page and returns at most five documents sharing a category or a tag (AC-08.01 through AC-08.04).

## 5.13 Document error codes

| code | status | condition | message |
|---|---|---|---|
| `UNSUPPORTED_TYPE` | 422 | Type not PDF, DOCX, XLSX, TXT | `Tipe file tidak didukung. Tipe yang diterima: PDF, DOCX, XLSX, TXT` |
| `FILE_TOO_LARGE` | 422 | Above `max_file_size_mb` | `Ukuran file melebihi batas {n} MB` |
| `BATCH_TOO_LARGE` | 422 | More than 20 files | `Maksimal 20 file per unggahan` |
| `QUOTA_EXCEEDED` | 422 | Quota reservation refused | `Kapasitas penyimpanan penuh` |
| `DUPLICATE_CONTENT` | 409 | Hash already in the tenant | `File ini sudah ada di sistem` |
| `IDENTICAL_CONTENT` | 409 | Hash equals the current version | `Isi file sama dengan versi yang sudah ada` |
| `UPLOAD_INTERRUPTED` | 400 | Stream truncated | `Unggahan terputus. Silakan coba lagi` |
| `MALWARE_DETECTED` | n/a | Reported through polling, not a response | `File terdeteksi mengandung malware dan tidak dapat diunggah` |
| `DOWNLOAD_FORBIDDEN` | 403 | Category not downloadable | `Kategori ini tidak diizinkan untuk diunduh` |
| `TOO_MANY_SELECTED` | 422 | More than 50 in a bulk download | `Maksimal 50 dokumen per unduhan massal` |
| `PREVIEW_UNAVAILABLE` | 422 | Conversion failed or content unreadable | `Preview tidak tersedia untuk dokumen ini` |

Standard codes are in [01-conventions.md 1.8](01-conventions.md).
