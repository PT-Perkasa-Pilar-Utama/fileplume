# 01 — Conventions

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

The transport contract every operation in this set obeys. Resource files cite this document; they do not restate it. Where a rule here disagrees with a resource file, this document wins.

The protocol is REST over JSON, decided in [../technical-specs/04-tech-stack.md 4.2](../technical-specs/04-tech-stack.md) and confirmed against the alternatives rejected in 4.9. Schemas are Zod in `packages/shared`, and the OpenAPI document is generated from them by `@hono/zod-openapi`, so a published contract cannot drift from the handler that serves it.

## 1.1 Base address

```
https://<subdomain>.archiva.id/api/v1
```

The tenant is resolved from the subdomain before any handler runs. See 1.12 for the full order of operations. There is no `tenantId` path segment and no `tenantId` request field on any tenant-scoped operation; supplying one is a validation error, not an override.

Super Admin operations are served on the reserved subdomain `admin`, which resolves to no tenant:

```
https://admin.archiva.id/api/v1
```

The reserved subdomain is an api-spec decision and is flagged as an amendment to [../technical-specs/09-authentication-authorization.md 9.4](../technical-specs/09-authentication-authorization.md), which fixes the resolution order but not the address a tenant-less principal uses. See [_index.md](_index.md) open items.

Versioning is by path prefix. `v1` is additive-only: a field may be added to a response, never removed or retyped, and a new required request field may not appear. A breaking change opens `v2`.

## 1.2 Content types

| Direction | Type | Where |
|---|---|---|
| Request, default | `application/json; charset=utf-8` | Every operation except upload |
| Request, upload | `multipart/form-data` | `POST /documents`, `POST /documents/:id/versions` |
| Response, default | `application/json; charset=utf-8` | Every operation except a byte stream |
| Response, file | The stored `mime_type`, or `application/pdf` for a converted preview, or `application/zip` for a bulk download | Download and preview |

JSON request bodies are capped at 1 MB. Uploads bypass the JSON parser and stream, bounded by the tenant's `max_file_size_mb` ([../technical-specs/07-security.md 7.4](../technical-specs/07-security.md)).

## 1.3 Authentication

A database-backed session cookie, not a bearer token ([../technical-specs/09-authentication-authorization.md 9.2](../technical-specs/09-authentication-authorization.md)).

```
Cookie: __Host-archiva_session=<opaque token>
```

The cookie is `httpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefixed. It carries an opaque random token, never a claims document. The session row is read from PostgreSQL on every request, which is what makes AC-14.02's "sejak saat itu" true: a revoked permission or an ended session takes effect on the very next request.

Absent, expired or revoked session: `401` with `SESSION_EXPIRED`, or `UNAUTHENTICATED` when no cookie was sent at all.

Two operational endpoints use a shared token instead of a session, because no user is behind them. See [10-system.md](10-system.md).

## 1.4 Success envelope

Every JSON success response wraps its payload in `data`. Nothing is returned at the top level.

```json
{
  "data": {
    "id": "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
    "title": "laporan.pdf"
  }
}
```

`204 No Content` responses carry no body at all.

## 1.5 Collection envelope and pagination

A collection returns an array in `data` and a `meta` object.

```json
{
  "data": [ { "id": "..." }, { "id": "..." } ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 123,
    "totalPages": 13
  }
}
```

| Parameter | Type | Default | Bounds | Notes |
|---|---|---|---|---|
| `page` | integer | 1 | >= 1 | 1-indexed |
| `limit` | integer | 10 | 1 to 100 | 10 is the row count AC-39.01 renders |
| `sort` | string | per operation | Enumerated per operation | Free field names are rejected |
| `order` | enum | `desc` | `asc`, `desc` | |

A `page` beyond the last returns `200` with an empty `data` array and truthful `meta`, never `404`. AC-39.01's "Menampilkan 1 - 10 dari 123 data" and AC-39.03's suppression of the page controls are both composed by the client from `page`, `limit` and `total`.

### 1.5.1 Empty-state messages

An empty result is a success, not an error. When a collection is empty for a reason the interface must explain, the server supplies the exact Indonesian string in `meta.message` so the copy is contract, not client invention.

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0,
            "message": "Tidak ada hasil yang ditemukan" }
}
```

| Message | Condition | Operation | Criterion |
|---|---|---|---|
| `Tidak ada hasil yang ditemukan` | Search returned nothing | `GET /search/titles`, `GET /search/content` | AC-07.02, AC-43.02 |
| `Belum ada dokumen. Seret file ke area unggah untuk memulai` | Tenant has no documents at all | `GET /documents` | AC-38.03 |
| `Tidak ada dokumen pada kategori ini` | Category filter matched nothing | `GET /documents` | AC-34.03 |
| `Tidak ada dokumen dengan kombinasi tag ini` | Tag filter matched nothing | `GET /documents` | AC-05.04 |
| `Dokumen tidak ditemukan` | Title search matched only documents inside another uploader's confirmation window | `GET /search/titles` | AC-02.05 |
| `Tidak ada dokumen terkait` | No related document shares a category or tag | `GET /documents/:id/related` | AC-08.02 |
| `Belum ada aktivitas tercatat` | Audit ledger empty for the tenant | `GET /audit-events` | AC-13.03 |
| `Belum ada aktivitas untuk ditampilkan` | Analytics has no data for the tenant | `GET /analytics/dashboard` | AC-12.04 |

`meta.notice` carries a message that accompanies a non-empty result. Release 1 has one: `Sebagian dokumen masih diproses dan belum dapat dicari` on content search while any document in the tenant is not READY (AC-33.03).

## 1.6 Error envelope

```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Kapasitas penyimpanan penuh. Hapus atau arsipkan dokumen lama untuk melanjutkan",
    "details": [
      { "field": "files[2]", "issue": "quota_exceeded" }
    ]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `code` | string | yes | `SCREAMING_SNAKE_CASE`, English, stable. This is what clients and tests branch on. |
| `message` | string | yes | Indonesian, verbatim from the acceptance criterion. Never translate it and never assert on an English paraphrase. |
| `details` | array | no | Field-level validation issues from Zod. Absent when the failure is not field-scoped. |

The language split is the policy in [../technical-specs/01-overview.md 1.2](../technical-specs/01-overview.md). A response never carries a stack trace, a driver message or an internal identifier ([../technical-specs/07-security.md 7.4](../technical-specs/07-security.md)).

## 1.7 HTTP status codes

| Status | Meaning in this API |
|---|---|
| 200 | Read succeeded, or a write whose result is the returned resource |
| 201 | Resource created. `Location` names it. |
| 202 | Accepted for asynchronous work. Body carries a `jobId`. |
| 204 | Write succeeded, nothing to return |
| 400 | Malformed request: unparseable body, missing multipart part, truncated upload |
| 401 | No session, expired session, revoked session, wrong credentials |
| 403 | Authenticated, inside the tenant, and refused. Role floor, ownership, or category permission. |
| 404 | Not found, or found in another tenant. The two are indistinguishable by design. |
| 409 | State conflict: duplicate content, duplicate name, taken subdomain |
| 413 | Upload body exceeded the transport cap before the handler could type the failure |
| 422 | Well-formed and semantically rejected: validation, quota, unsupported type, short query |
| 429 | Rate limit reached. `Retry-After` in seconds. |
| 500 | Unhandled server fault |
| 503 | A required dependency is down. Returned by `GET /health/ready` and by an operation whose datastore is unreachable. |

### 1.7.1 403 versus 404

Inside the caller's tenant, a refusal is `403`: the resource exists and the caller may not have it. Across tenants, a refusal is `404`, so a probe cannot confirm that an id is real. The rule and its rationale are in [../technical-specs/07-security.md 7.2](../technical-specs/07-security.md).

This contradicts AC-43.03 and AC-43.04, which say 403. The technical spec is deliberate and wins. See 1.13.

## 1.8 Standard error codes

Cross-cutting codes. Resource files add operation-specific codes and cite these rather than redefining them.

| Code | Status | Condition | Message |
|---|---|---|---|
| `VALIDATION_ERROR` | 422 | Zod rejected the request shape | Per field, in `details` |
| `UNAUTHENTICATED` | 401 | No session cookie | `Sesi Anda telah berakhir. Silakan login kembali` |
| `SESSION_EXPIRED` | 401 | Session absent, idle-expired or revoked | `Sesi Anda telah berakhir. Silakan login kembali` |
| `FORBIDDEN` | 403 | Role floor not met | `Anda tidak memiliki akses ke halaman ini` |
| `NOT_OWNER` | 403 | Ownership condition not met and the role does not bypass it | `Anda hanya dapat mengubah dokumen milik Anda` |
| `NOT_FOUND` | 404 | Absent, soft-deleted, or in another tenant | `Data tidak ditemukan` |
| `PAYLOAD_TOO_LARGE` | 413 | Body exceeded the transport cap | `Ukuran permintaan terlalu besar` |
| `RATE_LIMITED` | 429 | Rate limit reached | `Terlalu banyak permintaan. Coba lagi nanti` |
| `INTERNAL_ERROR` | 500 | Unhandled fault | `Terjadi kesalahan pada sistem` |
| `SERVICE_UNAVAILABLE` | 503 | A required dependency is unreachable | `Layanan sedang tidak tersedia` |

Every `403` writes an `audit_events` row with `outcome = "denied"` before the response is sent. That is not optional decoration: AC-13.02, AC-14.03, AC-41.05 and AC-47.03 each assert the denial appears in the audit trail.

## 1.9 Idempotency

Two mutating operations carry a replay risk the interface must absorb.

| Operation | Mechanism | Criterion |
|---|---|---|
| `POST /documents/:id/download` | `Idempotency-Key` request header, UUID | AC-10.04 |
| `POST /documents` | Content hash uniqueness at the database, not a header | AC-03.04 |

```
Idempotency-Key: 6f1d9b6e-6f0f-4c0e-9c47-2a1f4b5c6d7e
```

Within a 60-second window, a repeat of the same `(principal, documentId, Idempotency-Key)` returns the same result and writes exactly one `document.download` audit row. AC-10.04's double click therefore yields one file and one audit record. A request without the header is served normally and audited normally; the header is the client's tool for suppressing its own duplicate, not a permission check.

Duplicate upload is not solved by a header. It is decided by `UNIQUE (tenant_id, content_hash)` ([../technical-specs/06-data-model.md 6.5](../technical-specs/06-data-model.md)), so two simultaneous identical uploads lose on insert rather than on a read-then-check. AC-03.04 tests exactly that race.

## 1.10 Rate limits

From [../technical-specs/07-security.md 7.4](../technical-specs/07-security.md), enforced by `hono-rate-limiter` backed by Valkey.

| Scope | Limit | Applies to |
|---|---|---|
| Login | 5 per minute per IP and per email | `POST /auth/login` |
| Search | 60 per minute per session | `GET /search/*` |
| Upload | 100 per hour per user | `POST /documents`, `POST /documents/:id/versions` |
| Reset state | 1 per minute | `POST /admin/reset-state` |

Exceeding a limit returns `429` with `RATE_LIMITED` and a `Retry-After` header in seconds.

## 1.11 Role reference

Mirrors [../technical-specs/09-authentication-authorization.md 9.3](../technical-specs/09-authentication-authorization.md). Every **Access** line in this set names a floor from this table. Roles are totally ordered inside a tenant and everything above a floor inherits it.

| Role | Identifier | Scope | Inherits |
|---|---|---|---|
| Member Team | `member` | One tenant | |
| Head of Team | `head_of_team` | One tenant | `member` |
| Admin Tenant | `admin_tenant` | One tenant | `head_of_team` |
| Super Admin | `super_admin` | Outside all tenants, `tenant_id IS NULL` | Nothing. Not in the tenant chain. |

A `super_admin` reaches only operations whose floor is `super_admin`. There is no path by which a Super Admin reads tenant document content in release 1.

Every route declares its floor at registration. A route with no declared floor fails to compile, because the router helper requires the argument.

## 1.12 Request order of operations

Applied before any handler body runs ([../technical-specs/09-authentication-authorization.md 9.4](../technical-specs/09-authentication-authorization.md)).

1. Resolve the tenant from the subdomain. Unknown subdomain: `404`.
2. Resolve the session from the cookie. Absent or expired: `401`.
3. Assert the principal's `tenant_id` matches the resolved tenant. Mismatch: `404`, not `403`.
4. Apply the route's role floor. Below it: `403` and a denied audit event.
5. Apply any resource-level condition: ownership, or `classification.canDownloadCategory`.

A `super_admin` principal skips step 3 and is admitted only at step 4 to `super_admin` routes.

## 1.13 Deviations from the acceptance criteria

Recorded here rather than resolved silently. Each needs an amendment to the source document named in the last column.

| Item | AC says | This set specifies | Reason | Amend |
|---|---|---|---|---|
| Cross-tenant document detail | AC-43.03: status 403 | `404` | Existence must not leak across a tenant boundary | `docs/business/` AC-43.03 |
| Cross-tenant download | AC-43.04: status 403 | `404` | Same | `docs/business/` AC-43.04 |
| Configuration reset to default | AC-42.05 | `DELETE /configuration/:key` | `tenancy.setConfigValue` has no reset path | `../technical-specs/05-module-definitions.md` 5.1 |
| Super Admin address | Not stated | Reserved subdomain `admin` | Tenant resolution needs an address for a tenant-less principal | `../technical-specs/09-authentication-authorization.md` 9.4 |
| Origin-check refusal | 1.8: every `403` writes a denied audit event | `403 FORBIDDEN` with no audit row | The origin check runs before the session is read, so there is no principal or tenant to record against | This document 1.8 |
| Any-role operations | 1.11: every floor is a role | Floor `authenticated` on `POST /auth/logout` and `GET /auth/me` | "Any authenticated principal, any role" includes `super_admin`, which no role floor admits | This document 1.11 |

## 1.14 What has no operation

Three stories are satisfied entirely in the client and appear in no resource file. Recording them here keeps the tracker in [_index.md](_index.md) honest.

| Story | Why there is no endpoint |
|---|---|
| US-37, local table filter | AC-37.01 and AC-37.03 filter an already-loaded page in TanStack Table. AC-37.02's audit filter is additionally supported server-side by `GET /audit-events?q=`. |
| US-39, pagination | Satisfied by 1.5. The strings in AC-39.01 and AC-39.03 are composed from `meta`. |
| US-36, theme | `localStorage` in the SPA. AC-36.01 toggles it and AC-36.02's "tutup browser, buka kembali" is satisfied without server state, and the data model has no preference column. |
