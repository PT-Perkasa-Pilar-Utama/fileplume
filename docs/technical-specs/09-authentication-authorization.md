# 09 — Authentication and Authorization

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

Mechanism and headers are in `07-security.md`. This document is the role model and the matrix that routes are written against.

## 9.1 Role model

Four roles. Three of them form a total order inside a tenant; the fourth sits outside every tenant (grooming D10).

```
super_admin        outside all tenants, tenant_id IS NULL
                   creates tenants, sets quota, never reads document content

admin_tenant       inherits head_of_team
      |            edits configuration parameters
head_of_team       inherits member
      |            manages the taxonomy, toggles download permission,
      |            reads the audit trail and analytics, sees unconfirmed documents
member             uploads, confirms categories on own documents, searches,
                   previews, downloads what the taxonomy permits
```

The order is enforced by the database constraint in `06-data-model.md` 6.4, and expressed in code as a floor, not a set:

```ts
app.get("/audit", requireRole("head_of_team"), handler)
```

Adding a role between two existing ones later requires no edit to any existing guard. That is the reason for a floor rather than a list.

One role per user per tenant. A person who needs two tenants needs two accounts (`01-overview.md` 1.7 item 9).

## 9.2 Session strategy

| Property | Value | Reason |
|---|---|---|
| Store | `sessions` table in PostgreSQL | Instant revocation |
| Carrier | `__Host-` prefixed httpOnly cookie | Not readable by script |
| Contents | Opaque random token, hashed at rest | The cookie is not a claims document |
| Absolute lifetime | 30 days | |
| Idle lifetime | 8 hours on `last_seen_at` | AC-40.04 |
| Refresh | `last_seen_at` updated at most once per minute | Avoids a write on every request |
| Revocation | Delete the row | Effective on the next request |

Stateless JWT was considered and rejected. AC-14.02 requires a category permission change to take effect immediately, and AC-40.03 requires a logout to end the session. A JWT remains valid until it expires; making that window small enough to satisfy AC-14.02 means a refresh round trip on nearly every request, which is a database read with extra steps.

## 9.3 Role matrix

Read as: the minimum role required. Everything above it inherits.

### 9.3.1 Documents

| Action | Floor | Extra condition | Criteria |
|---|---|---|---|
| Upload | member | Quota, size, type, batch | US-01 |
| List and search own tenant | member | | US-07, US-33 |
| See an unconfirmed document | member | Uploader only, until the window elapses | AC-02.05, AC-02.06 |
| See any unconfirmed document | head_of_team | | AC-02.07 |
| Preview | member | | US-09 |
| Download | member | Category `download_active` is true | AC-10.01, AC-10.03 |
| Bulk download | member | Per-document, restricted ones omitted | AC-11.02 |
| Add a version | member | | AC-21.01 |
| Confirm or change a category | member | Own document only | AC-02.03, AC-02.04 |
| Override an AI field | member | Own document only | AC-47.01, AC-47.03 |
| Override on any document | head_of_team | | AC-47.04 |

### 9.3.2 Administration

| Action | Floor | Criteria |
|---|---|---|
| Create or rename a category | head_of_team | AC-45.01 |
| Toggle download permission | head_of_team | AC-14.01, AC-14.03 |
| Read the Uncategorized queue | head_of_team | AC-45.03 |
| Read the audit trail | head_of_team | AC-13.01 |
| Read analytics | head_of_team | AC-12.01 |
| Edit `max_file_size_mb` | admin_tenant | AC-42.02 |
| Edit `pending_confirmation_days` | admin_tenant | Grooming D4 |
| Read `storage_quota_gb` | admin_tenant | AC-42.01, read-only |
| Write `storage_quota_gb` | super_admin | Grooming D16 |
| Create a tenant | super_admin | AC-43.01 |
| Reset database state | Token, not a role | Non-production only, 07-security.md 7.6.2 |

### 9.3.3 Navigation, US-41

Navigation is derived from the same floors, so a menu cannot drift from the permission behind it.

| Role | Menus |
|---|---|
| member | Dashboard, Document |
| head_of_team | plus Permission Category, Audit Trail, Analitik |
| admin_tenant | plus Configuration |
| super_admin | Manajemen Tenant only, no tenant document menus |

The menu is presentation. `AC-41.05` asserts the server refuses the route regardless of what the menu shows.

## 9.4 Tenant resolution

Order of operations on every request, before any handler runs:

1. Resolve the tenant from the subdomain.
2. Resolve the session from the cookie. Absent or expired: 401.
3. Assert that the principal's `tenant_id` matches the resolved tenant. Mismatch: 404, not 403, so an id in another tenant is not confirmed.
4. Apply the route's role floor. Below it: 403 and a denied audit event.
5. Apply any resource-level condition, ownership or category permission.

A `super_admin` principal skips step 3 and is admitted only to routes whose floor is `super_admin`. There is no path by which a Super Admin reads tenant document content in release 1; the role exists to run the platform, not to browse it.

## 9.5 What is not in release 1

| Capability | Status |
|---|---|
| Multi-factor authentication | Deferred, flagged in 08-nfr.md 8.8 threat table |
| Single sign-on, SAML or OIDC | Deferred. `authenticate` becomes the port when it arrives. |
| Password reset by email | Deferred. Admin-initiated reset only in release 1. |
| Self-service registration | Not planned. Users are created by an administrator. |
| Per-user permission overrides | Not planned. Permission is a property of the category and the role, never of a person. |
| Signature roles from US-20 | Roadmap. They are a separate assignment and grant no system permission. |
