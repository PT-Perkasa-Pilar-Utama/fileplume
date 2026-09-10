# 03 — Tenants

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

Tenant creation and the storage quota only a Super Admin may set. Module: `tenancy` ([../technical-specs/05-module-definitions.md 5.1](../technical-specs/05-module-definitions.md)). Entities: `tenants` ([../technical-specs/06-data-model.md 6.3](../technical-specs/06-data-model.md)).

Every operation in this file is served on the reserved Super Admin address and is refused everywhere else:

```
https://admin.archiva.id/api/v1
```

A `super_admin` has `tenant_id IS NULL`, enforced by a database `CHECK` constraint ([../technical-specs/06-data-model.md 6.4](../technical-specs/06-data-model.md)), and reaches only routes whose floor is `super_admin`. There is no path by which a Super Admin reads tenant document content in release 1; the role exists to run the platform, not to browse it ([../technical-specs/09-authentication-authorization.md 9.4](../technical-specs/09-authentication-authorization.md)).

Tenant lifecycle beyond creation, suspension and deletion included, is out of scope for release 1 (US-15, US-16, [../technical-specs/01-overview.md 1.4.9](../technical-specs/01-overview.md)). `tenants.status` exists in the data model and is reported here, but no operation changes it.

## 3.1 POST /tenants

**Signature.** `POST /api/v1/tenants`

**Purpose.** Create an organisation and its isolation boundary. Triggered by "Simpan" on the Manajemen Tenant screen.

**Access.** `super_admin`. A tenant-scoped principal calling this on any subdomain receives `403` and a denied audit event.

**Input.** JSON body.

| field | type | required | notes |
|---|---|---|---|
| `name` | string | yes | 1 to 200 characters. The "Nama Organisasi" field. Unique across the platform. |
| `subdomain` | string | yes | 3 to 63 characters, `[a-z0-9-]`, no leading or trailing hyphen. DNS-safe, lowercased on write, `citext` at rest. |
| `storageQuotaGb` | integer | no | 1 to 10000. Defaults to 50, which is the `storage_quota_bytes` default of 53687091200 bytes. |

```json
{ "name": "PT Contoh Baru", "subdomain": "contohbaru", "storageQuotaGb": 50 }
```

**Behavior.**

1. `tenancy.createTenant(input)`.
2. Reject a taken name with `TENANT_NAME_TAKEN` and a taken subdomain with `SUBDOMAIN_TAKEN`. Both are decided by unique constraints, not by a read-then-check.
3. Insert the tenant with `status = "active"` and the resolved quota. AC-43.01 requires the default quota to be stored, not left null.
4. Seed the reserved `Uncategorized` category with `is_system = true`, so a document the AI cannot place has somewhere to go from the first upload (grooming D3, AC-06.03). Its `category_permissions` row is created with `download_active = false` like any other (AC-45.01).
5. Write a `tenant.create` audit event with `tenant_id` set to the new tenant.

Creating the reserved category here rather than lazily is deliberate. A lazily created system row is a row that can be missing at the moment the pipeline needs it, which turns AC-06.03 into a race.

**Output.** `201 Created`, `Location: /api/v1/tenants/{id}`.

```json
{
  "data": {
    "id": "1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b",
    "name": "PT Contoh Baru",
    "subdomain": "contohbaru",
    "status": "active",
    "storageQuotaBytes": 53687091200,
    "storageUsedBytes": 0,
    "createdAt": "2026-09-10T02:11:44.000Z"
  }
}
```

The client shows `Tenant berhasil ditambahkan` on `201` and appends the row to the table with status Active (AC-43.01).

**Errors.**

| code | status | condition |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Malformed subdomain, name too long, quota outside 1 to 10000 |
| `TENANT_NAME_TAKEN` | 409 | `name` already exists. Message: `Nama organisasi sudah digunakan` |
| `SUBDOMAIN_TAKEN` | 409 | `subdomain` already exists. Message: `Subdomain sudah digunakan` |
| `FORBIDDEN` | 403 | Caller is not `super_admin` |

**Traceability.** AC-43.01, US-43. Reserved category: AC-06.03, AC-45.01.

## 3.2 GET /tenants

**Signature.** `GET /api/v1/tenants`

**Purpose.** The Manajemen Tenant table. Triggered by opening the only menu a Super Admin has.

**Access.** `super_admin`.

**Input.** Query parameters.

| field | type | required | notes |
|---|---|---|---|
| `page` | integer | no | Default 1 |
| `limit` | integer | no | Default 10, max 100 |
| `sort` | enum | no | `createdAt`, `name`, `storageUsedBytes`. Default `createdAt` |
| `order` | enum | no | Default `desc` |
| `q` | string | no | Substring match on `name` and `subdomain` |

**Behavior.** Reads `tenants`. Returns counts and quota figures only. No document title, no user name, no content of any kind crosses into this response.

**Output.** `200 OK`, collection envelope per [01-conventions.md 1.5](01-conventions.md).

```json
{
  "data": [
    {
      "id": "1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b",
      "name": "PT Contoh Baru",
      "subdomain": "contohbaru",
      "status": "active",
      "storageQuotaBytes": 53687091200,
      "storageUsedBytes": 13421772800,
      "storagePercent": 25,
      "documentCount": 412,
      "userCount": 9,
      "createdAt": "2026-09-10T02:11:44.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

**Errors.**

| code | status | condition |
|---|---|---|
| `FORBIDDEN` | 403 | Caller is not `super_admin` |

**Traceability.** AC-41.04, US-43.

## 3.3 PATCH /tenants/:tenantId/quota

**Signature.** `PATCH /api/v1/tenants/{tenantId}/quota`

**Purpose.** Set an organisation's storage quota. This is the only write path for `storage_quota_gb`; the tenant-side configuration operation refuses it ([04-configuration.md 4.3](04-configuration.md)).

**Access.** `super_admin`. Grooming D16 and [../technical-specs/09-authentication-authorization.md 9.3.2](../technical-specs/09-authentication-authorization.md).

**Input.** Path parameter `tenantId` (uuid), JSON body.

| field | type | required | notes |
|---|---|---|---|
| `storageQuotaGb` | integer | yes | 1 to 10000 |

**Behavior.**

1. Resolve the tenant. Unknown id: `404`.
2. Write `tenants.storage_quota_bytes`. Lowering it below current usage is permitted and does not delete anything; the tenant simply cannot upload until usage falls, and `GET /storage` reports over 100 percent honestly rather than clamping.
3. Write a `config.change` audit event against the target tenant, with the key and both values in `metadata`.

Permitting a quota below current usage is a choice, not an oversight. Refusing it would mean a Super Admin cannot correct an over-provisioned tenant without first deleting the customer's documents.

**Output.** `200 OK`, the tenant object from 3.2.

**Errors.**

| code | status | condition |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Outside 1 to 10000, or not an integer |
| `NOT_FOUND` | 404 | Unknown `tenantId` |
| `FORBIDDEN` | 403 | Caller is not `super_admin` |

**Traceability.** AC-42.01 (read-only presentation on the tenant side), grooming D16, US-35.

## 3.4 Tenant resource shape

| field | type | nullable | source |
|---|---|---|---|
| `id` | uuid | no | `tenants.id` |
| `name` | string | no | `tenants.name` |
| `subdomain` | string | no | `tenants.subdomain` |
| `status` | enum `active`, `suspended` | no | `tenants.status` |
| `storageQuotaBytes` | integer | no | `tenants.storage_quota_bytes` |
| `storageUsedBytes` | integer | no | `tenants.storage_used_bytes`, maintained by the quota protocol |
| `storagePercent` | integer | no | Derived, rounded down. Present on list, absent on create. |
| `documentCount` | integer | no | Count of non-deleted documents. List only. |
| `userCount` | integer | no | List only. |
| `createdAt` | timestamp | no | ISO 8601 UTC |

Byte counts are integers, never floats ([../technical-specs/06-data-model.md 6.1](../technical-specs/06-data-model.md)). Values above `Number.MAX_SAFE_INTEGER` are not reachable at the volumes in [../technical-specs/08-nfr.md 8.1](../technical-specs/08-nfr.md); if that changes, they become strings in `v2`.
