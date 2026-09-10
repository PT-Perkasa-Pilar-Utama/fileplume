# 06 — Categories and Classification

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

The category taxonomy, what each document is filed under, and whether a category may be downloaded. Module: `classification` ([../technical-specs/05-module-definitions.md 5.4](../technical-specs/05-module-definitions.md)). Entities: `categories`, `category_permissions`, `document_classification` ([../technical-specs/06-data-model.md 6.7](../technical-specs/06-data-model.md)).

Conventions in [01-conventions.md](01-conventions.md) apply.

Two rules govern everything in this file:

1. A new category's download permission starts Inactive. There is no way to create one already active; activating is a second, audited action (AC-45.01, module invariant 5.4.1).
2. The AI never creates a category. `suggest` accepts only an existing id, and an unclassifiable document is filed under the reserved `Uncategorized` row (grooming D3, AC-06.03, module invariant 5.4.2).

Role comparison is deliberately absent from this module. That stays in `identity`, and `catalog` composes the two. A merged policy module was considered and rejected as shallow ([../technical-specs/05-module-definitions.md 5.4](../technical-specs/05-module-definitions.md)).

## 6.1 Category resource shape

| field | type | nullable | source |
|---|---|---|---|
| `id` | uuid | no | `categories.id` |
| `name` | string | no | `categories.name`, unique per tenant |
| `isSystem` | boolean | no | `categories.is_system`, true for the reserved `Uncategorized` row |
| `downloadActive` | boolean | no | `category_permissions.download_active` |
| `documentCount` | integer | no | Non-deleted documents currently filed under it |
| `createdBy` | object | yes | `{ id, name }`. Null for the system row. |
| `createdAt` | timestamp | no | ISO 8601 UTC |
| `permissionUpdatedAt` | timestamp | yes | `category_permissions.updated_at` |
| `permissionUpdatedBy` | object | yes | `{ id, name }` |

## 6.2 GET /categories

**Signature.** `GET /api/v1/categories`

**Purpose.** Two jobs, one operation: the Permission Category table for a Head of Team, and the category picker a Member Team sees on an unconfirmed document (AC-02.02) and in the filter control (AC-34.01).

**Access.** `member`. The taxonomy is not secret; the permission toggle it carries is enforced elsewhere, and a member needs the list to file their own documents.

**Input.** Query parameters.

| field | type | required | notes |
|---|---|---|---|
| `page` | integer | no | Default 1 |
| `limit` | integer | no | Default 10, max 100. The picker requests 100. |
| `sort` | enum | no | `name`, `createdAt`, `documentCount`. Default `name` |
| `order` | enum | no | Default `asc` |
| `q` | string | no | Substring match on `name` |

**Behavior.** Reads `categories` joined to `category_permissions` and a document count. The reserved `Uncategorized` row is included and marked `isSystem: true`, so the client can order it last and refuse to offer a rename.

**Output.** `200 OK`, collection envelope.

```json
{
  "data": [
    {
      "id": "7b2f0c93-1d84-4a6e-9b52-6c7d8e9f0a1b",
      "name": "Reporting",
      "isSystem": false,
      "downloadActive": false,
      "documentCount": 34,
      "createdBy": { "id": "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", "name": "Sari Dewi" },
      "createdAt": "2026-09-02T07:40:00.000Z",
      "permissionUpdatedAt": null,
      "permissionUpdatedBy": null
    },
    {
      "id": "0000aaaa-1111-4bbb-8ccc-ddddeeeeffff",
      "name": "Uncategorized",
      "isSystem": true,
      "downloadActive": false,
      "documentCount": 6,
      "createdBy": null,
      "createdAt": "2026-09-01T00:00:00.000Z",
      "permissionUpdatedAt": null,
      "permissionUpdatedBy": null
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 2, "totalPages": 1 }
}
```

**Errors.** None specific.

**Traceability.** AC-02.02, AC-34.01, AC-45.01, US-45.

## 6.3 POST /categories

**Signature.** `POST /api/v1/categories`

**Purpose.** Add a category to the tenant's taxonomy. Triggered by "Tambah Kategori" then "Simpan".

**Access.** `head_of_team` ([../technical-specs/09-authentication-authorization.md 9.3.2](../technical-specs/09-authentication-authorization.md)).

**Input.** JSON body.

| field | type | required | notes |
|---|---|---|---|
| `name` | string | yes | 1 to 100 characters, trimmed. The "Nama Kategori" field. |

```json
{ "name": "Reporting" }
```

There is no `downloadActive` field. Accepting one would make AC-45.01 a matter of what the client sent.

**Behavior.**

1. `classification.createCategory(tenantId, name, actor)`.
2. Reject a name already present in the tenant with `DUPLICATE_NAME`. Uniqueness is `UNIQUE (tenant_id, name)` compared case-insensitively, so "Reporting" and "reporting" collide (AC-45.02).
3. Insert the category and its `category_permissions` row with `download_active = false` in the same transaction. A category without a permission row is not a reachable state.
4. Write a `category.create` audit event.

**Output.** `201 Created`, `Location: /api/v1/categories/{id}`, the shape in 6.1 with `downloadActive: false`. The client shows `Kategori berhasil ditambahkan` and renders the toggle as Inactive (AC-45.01).

**Errors.**

| code | status | condition | message |
|---|---|---|---|
| `DUPLICATE_NAME` | 409 | Name already in the tenant (AC-45.02) | `Kategori dengan nama tersebut sudah ada` |
| `VALIDATION_ERROR` | 422 | Empty or over-length name | Per field |
| `FORBIDDEN` | 403 | Below `head_of_team` | Standard |

**Traceability.** AC-45.01, AC-45.02.

## 6.4 PATCH /categories/:id

**Signature.** `PATCH /api/v1/categories/{id}`

**Purpose.** Rename a category. The role matrix pairs create and rename at the same floor.

**Access.** `head_of_team`.

**Input.** Path parameter `id`. JSON body with `name`, validated as in 6.3.

**Behavior.**

1. Resolve within the tenant. Other tenant or unknown: `404`.
2. Refuse the reserved row with `SYSTEM_CATEGORY_IMMUTABLE`. The pipeline files unclassifiable documents under a name the code knows; renaming it would leave AC-06.03 pointing at nothing.
3. Reject a colliding name with `DUPLICATE_NAME`.
4. Documents keep their `category_id`, so a rename never reclassifies anything and never disturbs the download permission.
5. Write a `category.create` audit event with `metadata.action: "rename"` and both names. The `audit_action` enum has no separate rename member; reusing the create action with metadata avoids a migration for a rename nobody filters on independently.

**Output.** `200 OK`, the updated category.

**Errors.**

| code | status | condition | message |
|---|---|---|---|
| `DUPLICATE_NAME` | 409 | Name collides | `Kategori dengan nama tersebut sudah ada` |
| `SYSTEM_CATEGORY_IMMUTABLE` | 422 | `isSystem` is true | `Kategori sistem tidak dapat diubah` |
| `NOT_FOUND` | 404 | Unknown or other tenant | Standard |
| `FORBIDDEN` | 403 | Below `head_of_team` | Standard |

**Traceability.** [../technical-specs/09-authentication-authorization.md 9.3.2](../technical-specs/09-authentication-authorization.md), US-45.

There is no delete operation. Deleting a category would strand every document filed under it, and no criterion asks for it.

## 6.5 PUT /categories/:id/download-permission

**Signature.** `PUT /api/v1/categories/{id}/download-permission`

**Purpose.** Turn download on or off for every document in a category. Triggered by the toggle on the Permission Category screen.

**Access.** `head_of_team`. A Member Team calling it directly receives `403`, the permission is unchanged, and the attempt is recorded (AC-14.03).

`PUT` rather than `PATCH` because the request states the whole desired state of a single boolean. Two clients toggling concurrently converge on the value each sent, rather than on the order in which two flips arrived.

**Input.** Path parameter `id`. JSON body.

| field | type | required | notes |
|---|---|---|---|
| `downloadActive` | boolean | yes | The desired state, not a flip instruction |

```json
{ "downloadActive": true }
```

**Behavior.**

1. Resolve within the tenant. Other tenant or unknown: `404`.
2. `classification.setDownloadPermission(tenantId, categoryId, active, actor)`.
3. Write a `category.permission_change` audit event with both values (AC-14.01, AC-14.03).
4. The change is effective immediately. `canDownloadCategory` reads current state and never a cache with a TTL, and the session is read from the database on every request, so the next download request sees the new value (AC-14.02, module invariant 5.4.5).

Setting the value it already has is not an error and still writes an audit row. A toggle that reports success without a record would leave a gap in the trail AC-13.01 reads.

Turning a permission off does not revoke an outstanding bulk-download ticket ([05-documents.md 5.10](05-documents.md)). The ticket's permission check and its audit rows both happened at creation; the window is five minutes and the access is already on the record.

**Output.** `200 OK`, the updated category from 6.1.

**Errors.**

| code | status | condition |
|---|---|---|
| `NOT_FOUND` | 404 | Unknown or other tenant |
| `FORBIDDEN` | 403 | Below `head_of_team` (AC-14.03) |
| `VALIDATION_ERROR` | 422 | `downloadActive` missing or not a boolean |

**Traceability.** AC-14.01, AC-14.02, AC-14.03, AC-10.02, AC-10.03.

## 6.6 PUT /documents/:id/classification

**Signature.** `PUT /api/v1/documents/{id}/classification`

**Purpose.** Confirm the suggested category, or replace it and confirm that. One operation, because AC-02.03 and AC-02.04 are the same user action with different inputs: the member presses "Konfirmasi" either way.

**Access.** `member` for a document they uploaded. `head_of_team` for any document in the tenant (AC-47.04 establishes the same bypass for AI fields; the review queue in AC-45.03 requires it here).

**Input.** Path parameter `id`. JSON body.

| field | type | required | notes |
|---|---|---|---|
| `categoryId` | uuid | yes | An existing category in this tenant. To accept the suggestion, send the suggested id. |

```json
{ "categoryId": "7b2f0c93-1d84-4a6e-9b52-6c7d8e9f0a1b" }
```

Requiring the id even when accepting the suggestion is deliberate. A bodyless "confirm" would confirm whatever the server currently suggests, which is not necessarily what the user read on screen if the pipeline finished a re-run in between.

**Behavior.**

1. Resolve the document. Unknown, other tenant, or window-hidden: `404`.
2. Ownership: refuse with `NOT_OWNER` unless the caller uploaded it or is `head_of_team` or above.
3. Validate `categoryId` exists in this tenant. A category id from another tenant is `VALIDATION_ERROR`, not `404`, because the document was found and the field is what is wrong.
4. `classification.confirm(documentId, categoryId, actor)`. Sets `category_id`, `confirmed_at` and `confirmed_by`.
5. `ai_suggested_category_id` is never overwritten. It is retained forever and is the accuracy metric behind AC-12.03 (module invariant 5.4.3).
6. If the confirmed category differs from the suggestion, write an `ai_field_overrides` row with `field = "category"`, the original AI value and the new value, plus an `ai.override` audit event (AC-02.04).
7. Reindex the document so the category filter and related-document lookup see the new value.

Once `confirmed_at` is set the document leaves the "UPLOADED DOCUMENT" tray, because the tray is `?unconfirmedOnly=true` and the predicate is `confirmed_at IS NULL` (AC-02.03, AC-02.04).

**Output.** `200 OK`, the document in the shape of [05-documents.md 5.1](05-documents.md), with `category.isSuggestion` now false.

```json
{
  "data": {
    "id": "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
    "category": { "id": "7b2f0c93-1d84-4a6e-9b52-6c7d8e9f0a1b", "name": "Technical Spec",
                  "isSuggestion": false, "isSystem": false },
    "confirmedAt": "2026-09-10T05:02:31.000Z",
    "confirmedBy": { "id": "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", "name": "Budi Santoso" }
  }
}
```

**Errors.**

| code | status | condition | message |
|---|---|---|---|
| `NOT_OWNER` | 403 | Not the uploader and below `head_of_team` | `Anda hanya dapat mengubah dokumen milik Anda` |
| `NOT_FOUND` | 404 | Unknown document, other tenant, or window-hidden | Standard |
| `VALIDATION_ERROR` | 422 | `categoryId` absent, malformed, or not in this tenant | Per field |

**Traceability.** AC-02.03, AC-02.04, AC-12.03.

## 6.7 The suggestion state on a document

A document's `category` object carries `isSuggestion`, which is `confirmed_at IS NULL`. The client renders the "Saran" marker from it (AC-02.01) and removes the marker once confirmation lands (AC-02.03).

There is no stored suggestion state beyond that flag and the retained `ai_suggested_category_id`. `SUGGESTED` and `VISIBLE_UNCONFIRMED` are the same row differing by an age predicate ([../technical-specs/06-data-model.md 6.10.2](../technical-specs/06-data-model.md)); the visibility half of that predicate is specified once, in [05-documents.md 5.4.1](05-documents.md), and applies to every read path.

The "UPLOADED DOCUMENT" tray is `GET /documents?unconfirmedOnly=true`. For a `member` it returns their own unconfirmed documents; for `head_of_team` and above it returns the tenant's, which is the same data AC-02.07 describes.

## 6.8 GET /documents/unconfirmed

**Signature.** `GET /api/v1/documents/unconfirmed`

**Purpose.** The "Uncategorized" review queue: everything a Head of Team must file, whether the AI could not place it or the uploader has not confirmed it.

**Access.** `head_of_team`.

**Input.** Query parameters.

| field | type | required | notes |
|---|---|---|---|
| `page`, `limit`, `sort`, `order` | | no | Standard. `sort` accepts `createdAt`, `title`. Default `createdAt` ascending, oldest first, because this is a work queue. |
| `reason` | enum | no | `uncategorized` for documents on the reserved category, `unconfirmed` for documents with a suggestion nobody has accepted. Omit for both. |

**Behavior.** Returns documents in the tenant where `confirmed_at IS NULL`, including those filed under the reserved `Uncategorized` category. The confirmation window does not apply: `head_of_team` bypasses it, which is precisely what makes AC-02.07 work on a document uploaded today.

This is a distinct operation rather than a filter on `GET /documents` because it declares a `head_of_team` floor at registration. Expressing it as a query parameter would make the guard conditional on a parameter value, and a guard that depends on the request body is the shape AC-41.05 exists to catch.

**Output.** `200 OK`, documents in the shape of [05-documents.md 5.1](05-documents.md), each carrying `uploader` and `createdAt`, which are the columns AC-45.03 names.

Empty result: `meta.message` is `Tidak ada dokumen menunggu kategori`.

**Errors.**

| code | status | condition |
|---|---|---|
| `FORBIDDEN` | 403 | Below `head_of_team` |

**Traceability.** AC-45.03, AC-02.07, AC-06.03.

## 6.9 Classification error codes

| code | status | condition | message |
|---|---|---|---|
| `DUPLICATE_NAME` | 409 | Category name already in the tenant | `Kategori dengan nama tersebut sudah ada` |
| `SYSTEM_CATEGORY_IMMUTABLE` | 422 | Rename attempted on the reserved row | `Kategori sistem tidak dapat diubah` |
| `NOT_OWNER` | 403 | Classification change on someone else's document below `head_of_team` | `Anda hanya dapat mengubah dokumen milik Anda` |

Standard codes are in [01-conventions.md 1.8](01-conventions.md).
