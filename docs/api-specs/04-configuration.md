# 04 — Configuration and Storage

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

The tenant's operating parameters and its storage accounting. Module: `tenancy` ([../technical-specs/05-module-definitions.md 5.1](../technical-specs/05-module-definitions.md)). Entities: `tenant_config`, `tenants`, `quota_reservations` ([../technical-specs/06-data-model.md 6.3](../technical-specs/06-data-model.md)).

Conventions in [01-conventions.md](01-conventions.md) apply. Served on the tenant subdomain.

## 4.1 The closed key set

`ConfigKey` is a closed union, never a free string (grooming D16, module invariant 5.1.1). An unknown key is a validation error, not a silent miss. The authoritative table of keys, types, defaults and ranges is [../technical-specs/06-data-model.md 6.3](../technical-specs/06-data-model.md); it is mirrored here because every request in this file names one of these three values in a path segment.

| `key` | type | default | range | write floor | UI label |
|---|---|---|---|---|---|
| `max_file_size_mb` | integer | 20 | 1 to 200 | `admin_tenant` | Max File Size |
| `pending_confirmation_days` | integer | 7 | 1 to 90 | `admin_tenant` | Batas Waktu Konfirmasi Kategori |
| `storage_quota_gb` | integer | 50 | 1 to 10000 | `super_admin` only | Kuota Penyimpanan |

`storage_quota_gb` is readable here and writable only through [03-tenants.md 3.3](03-tenants.md). AC-42.01 lists it on the Configuration page; it renders read-only.

There is no operation that adds a key. Adding one is a migration plus an edit to the enum, reviewed like any other schema change.

## 4.2 GET /configuration

**Signature.** `GET /api/v1/configuration`

**Purpose.** The Configuration table. Triggered by the "Configuration" menu.

**Access.** `admin_tenant`. A `head_of_team` or `member` receives `403` and a denied audit event (AC-41.05 applies to every administration route, not only the one it names).

**Input.** None. The tenant comes from the subdomain.

**Behavior.** Reads every key in the closed set, falling back to the key's default where no `tenant_config` row exists. A missing row is not an error and not a null; an unset parameter reports its default with `isDefault: true`, which is what makes AC-42.05 observable.

**Output.** `200 OK`. A fixed-length list of three, so the client never renders a partial table.

```json
{
  "data": [
    {
      "key": "max_file_size_mb",
      "label": "Max File Size",
      "value": 50,
      "defaultValue": 20,
      "unit": "MB",
      "min": 1,
      "max": 200,
      "editable": true,
      "isDefault": false,
      "updatedAt": "2026-09-09T08:22:10.000Z",
      "updatedBy": { "id": "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", "name": "Sari Dewi" }
    },
    {
      "key": "pending_confirmation_days",
      "label": "Batas Waktu Konfirmasi Kategori",
      "value": 7, "defaultValue": 7, "unit": "hari",
      "min": 1, "max": 90,
      "editable": true, "isDefault": true,
      "updatedAt": null, "updatedBy": null
    },
    {
      "key": "storage_quota_gb",
      "label": "Kuota Penyimpanan",
      "value": 50, "defaultValue": 50, "unit": "GB",
      "min": 1, "max": 10000,
      "editable": false, "isDefault": true,
      "updatedAt": null, "updatedBy": null
    }
  ],
  "meta": { "total": 3 }
}
```

`label` and `unit` are Indonesian where AC-42.01 shows them in Indonesian, and are served rather than hardcoded in the client so the table and the validation ranges cannot drift apart. `editable: false` on `storage_quota_gb` drives the read-only row; it is presentation support, and 4.3 refuses the write regardless of what the client did with it.

**Errors.**

| code | status | condition |
|---|---|---|
| `FORBIDDEN` | 403 | Below `admin_tenant` |

**Traceability.** AC-42.01. `pending_confirmation_days` visibility: grooming D4, AC-02.05, AC-02.06.

## 4.3 PATCH /configuration/:key

**Signature.** `PATCH /api/v1/configuration/{key}`

**Purpose.** Change one operating parameter. Triggered by the row's edit control and its check icon.

**Access.** `admin_tenant` for `max_file_size_mb` and `pending_confirmation_days`. No role reaches `storage_quota_gb` here: the operation returns `NOT_EDITABLE_BY_TENANT` regardless of the caller's role inside the tenant (module invariant 5.1.2).

**Input.** Path parameter `key`, one of the three in 4.1. JSON body.

| field | type | required | notes |
|---|---|---|---|
| `value` | integer | yes | Typed per key. A string that looks like a number is rejected, not coerced. |

```json
{ "value": 50 }
```

**Behavior.**

1. Validate `key` against the closed set. Unknown key: `VALIDATION_ERROR`, not `404`, because the key space is a type rather than a resource collection.
2. Reject `storage_quota_gb` with `NOT_EDITABLE_BY_TENANT` before any role check, so the refusal does not depend on the caller's rank.
3. Type check. A non-integer yields `INVALID_CONFIG_VALUE` with `Nilai harus berupa angka` (AC-42.03). No coercion: `"dua puluh"` and `"20"` are both rejected, because a coerced string is a value nobody typed.
4. Range check against the key's `min` and `max`. Out of range yields `VALUE_OUT_OF_RANGE` with the interpolated message, `Nilai harus antara 1 dan 200 MB` for `max_file_size_mb` (AC-42.04).
5. `tenancy.setConfigValue(tenantId, key, value, actor)` upserts the row.
6. Write a `config.change` audit event carrying `key`, `previousValue` and `value` (AC-42.02).

On any rejection the stored value is unchanged, which both AC-42.03 and AC-42.04 assert explicitly.

A changed `max_file_size_mb` applies to the next upload. It is never applied retroactively: documents already stored above the new limit stay stored and stay downloadable.

**Output.** `200 OK`, the single parameter object from 4.2. The client shows `Konfigurasi berhasil disimpan`.

```json
{
  "data": {
    "key": "max_file_size_mb", "label": "Max File Size",
    "value": 50, "defaultValue": 20, "unit": "MB",
    "min": 1, "max": 200,
    "editable": true, "isDefault": false,
    "updatedAt": "2026-09-10T04:01:19.000Z",
    "updatedBy": { "id": "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", "name": "Sari Dewi" }
  }
}
```

**Errors.**

| code | status | condition | message |
|---|---|---|---|
| `VALIDATION_ERROR` | 422 | `key` not in the closed set, or `value` missing | Per field |
| `INVALID_CONFIG_VALUE` | 422 | `value` is not an integer (AC-42.03) | `Nilai harus berupa angka` |
| `VALUE_OUT_OF_RANGE` | 422 | Outside the key's range (AC-42.04) | `Nilai harus antara 1 dan 200 MB`, interpolated per key |
| `NOT_EDITABLE_BY_TENANT` | 403 | `key` is `storage_quota_gb` | `Parameter ini hanya dapat diubah oleh Super Admin` |
| `FORBIDDEN` | 403 | Below `admin_tenant` | Standard |

**Traceability.** AC-42.02, AC-42.03, AC-42.04. Range source: [../technical-specs/06-data-model.md 6.3](../technical-specs/06-data-model.md).

## 4.4 DELETE /configuration/:key

**Signature.** `DELETE /api/v1/configuration/{key}`

**Purpose.** Return one parameter to its default. Triggered by "Kembalikan ke Default" on the row.

**Access.** Same as 4.3.

**Input.** Path parameter `key`. No body.

**Behavior.**

1. Same key validation and same `storage_quota_gb` refusal as 4.3.
2. Delete the `tenant_config` row. The parameter then resolves to the default in 4.1, which is why the response reports `isDefault: true` rather than a written-back copy of the default. Storing the default as a value would make a later change to that default invisible to every tenant that had ever pressed this control.
3. Deleting a row that does not exist is not an error. The operation is idempotent: the post-state is "this parameter is at its default" either way.
4. Write a `config.change` audit event with `value` set to the default and `metadata.reset: true`.

**Output.** `200 OK`, the parameter object with `value` equal to `defaultValue` and `isDefault: true`. The client shows `Konfigurasi berhasil disimpan` (AC-42.05).

**Errors.** As 4.3, minus `INVALID_CONFIG_VALUE` and `VALUE_OUT_OF_RANGE`.

**Traceability.** AC-42.05.

This operation is an addition to the `tenancy` public interface, which has `setConfigValue` and no reset path. Flagged in [01-conventions.md 1.13](01-conventions.md) as an amendment to [../technical-specs/05-module-definitions.md 5.1](../technical-specs/05-module-definitions.md).

## 4.5 GET /storage

**Signature.** `GET /api/v1/storage`

**Purpose.** The storage capacity indicator. Read on dashboard load and refetched after an upload settles.

**Access.** `member`. Every role in the tenant sees the same figures; US-35 is a Member Team story.

**Input.** None.

**Behavior.** `tenancy.getQuotaUsage(tenantId)`. Reports committed usage, not usage plus outstanding reservations, so the number a user reads is the number their documents occupy. `percent` is rounded down and is not clamped: a quota lowered below usage reports above 100 rather than a comfortable lie.

**Output.** `200 OK`.

```json
{
  "data": {
    "usedBytes": 13421772800,
    "quotaBytes": 53687091200,
    "percent": 25,
    "level": "ok",
    "message": null
  }
}
```

`level` and its message drive the indicator colour and the warning banner:

| `level` | Condition | `message` | Criterion |
|---|---|---|---|
| `ok` | below 80 percent | `null` | AC-35.01 |
| `warning` | 80 percent or above, below 100 | `Kapasitas penyimpanan hampir penuh` | AC-35.02 |
| `full` | 100 percent or above | `Kapasitas penyimpanan penuh. Hapus atau arsipkan dokumen lama untuk melanjutkan` | AC-35.03 |

The 80 percent threshold lives on the server. Putting it in the client would let the banner and the upload refusal disagree.

**Errors.** None specific.

**Traceability.** AC-35.01, AC-35.02.

## 4.6 The quota protocol is not exposed

`reserveQuota`, `commitQuota`, `releaseQuota` and `revertCommit` are internal to `tenancy` and have no endpoint. A client cannot reserve capacity, and there is no operation that reports a reservation.

This is the point of module invariant 5.1.4: reading `GET /storage` and then deciding whether to upload is a race, and AC-35.04 tests exactly that race. The upload operation reserves before it writes a blob and commits after each row lands, or releases on any failure ([05-documents.md 5.2](05-documents.md)). A later session expiry debits committed bytes back through `revertCommit`. Reservations expire after 15 minutes and are swept, so an abandoned upload returns its capacity without an operator touching anything.

Consequently AC-01.07's interrupted upload leaves the quota untouched, and AC-35.04's third file is refused inside the same request that accepted the first two.

## 4.7 Configuration error codes

| code | status | condition | message |
|---|---|---|---|
| `INVALID_CONFIG_VALUE` | 422 | Value fails the key's type | `Nilai harus berupa angka` |
| `VALUE_OUT_OF_RANGE` | 422 | Value outside the key's range | `Nilai harus antara {min} dan {max} {unit}` |
| `NOT_EDITABLE_BY_TENANT` | 403 | `storage_quota_gb` write attempted from a tenant | `Parameter ini hanya dapat diubah oleh Super Admin` |

Standard codes are in [01-conventions.md 1.8](01-conventions.md).
