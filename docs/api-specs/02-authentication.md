# 02 — Authentication

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

Session issue, session end, and the principal a session resolves to. Module: `identity` ([../technical-specs/05-module-definitions.md 5.2](../technical-specs/05-module-definitions.md)). Mechanism and cookie attributes: [../technical-specs/09-authentication-authorization.md 9.2](../technical-specs/09-authentication-authorization.md) and [../technical-specs/07-security.md 7.1](../technical-specs/07-security.md).

Conventions in [01-conventions.md](01-conventions.md) apply. Release 1 has no self-service registration, no password reset by email and no SSO ([../technical-specs/09-authentication-authorization.md 9.5](../technical-specs/09-authentication-authorization.md)), so there is no operation for any of them.

## 2.1 Session carrier

The credential is a database-backed opaque token in a cookie, never a JWT. The full reasoning is in 9.2: AC-14.02 requires a category permission change to bite on the next request, and AC-40.03 requires a logout to end the session. A stateless token cannot promise either without a refresh round trip on nearly every request, which is a database read with extra steps.

| Property | Value |
|---|---|
| Cookie name | `__Host-archiva_session` |
| Attributes | `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/` |
| Contents | Opaque random token. Hashed at rest in `sessions.token_hash`; the row id is never in the cookie. |
| Absolute lifetime | `SESSION_ABSOLUTE_TTL_DAYS`, 30 |
| Idle lifetime | `SESSION_IDLE_TTL_HOURS`, 8, on `sessions.last_seen_at` (AC-40.04) |
| Refresh | `last_seen_at` written at most once per minute |
| Revocation | Delete the row. Effective on the next request. |

Idle expiry is evaluated on read, not by a sweeper, so an expired session is never briefly valid ([../technical-specs/05-module-definitions.md 5.2](../technical-specs/05-module-definitions.md) invariant 4).

## 2.2 POST /auth/login

**Signature.** `POST /api/v1/auth/login`

**Purpose.** Exchange an email and password for a session cookie. Triggered by the Login screen's "Login" button.

**Access.** Public. This is the only tenant-scoped operation reachable without a session. The tenant is still resolved from the subdomain first, so a user of tenant A cannot log in at tenant B's address.

**Input.** JSON body.

| field | type | required | notes |
|---|---|---|---|
| `email` | string, email | yes | `citext` at rest, so case is not significant |
| `password` | string | yes | 1 to 200 characters. Never logged, never echoed. |

```json
{ "email": "budi@contohbaru.co.id", "password": "..." }
```

**Behavior.**

1. Rate limit: 5 per minute per IP and per email ([01-conventions.md 1.10](01-conventions.md)).
2. Resolve the tenant from the subdomain. Unknown subdomain: `404`.
3. `identity.authenticate(email, password)`. Argon2id via `Bun.password`.
4. On failure, return `INVALID_CREDENTIALS`. Unknown email and wrong password return the same code, the same message and in the same time (AC-40.02, [../technical-specs/05-module-definitions.md 5.2](../technical-specs/05-module-definitions.md) invariant 5). Write an `auth.login_failed` audit event.
5. On success, assert the user's `tenant_id` matches the resolved tenant. Mismatch: `INVALID_CREDENTIALS`, not a distinct error, so the response does not confirm the account exists elsewhere.
6. Insert a `sessions` row, set the cookie, write an `auth.login` audit event.

**Output.** `200 OK`, plus `Set-Cookie`.

```json
{
  "data": {
    "user": {
      "id": "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10",
      "name": "Budi Santoso",
      "email": "budi@contohbaru.co.id",
      "role": "member",
      "avatarUrl": null
    },
    "tenant": { "id": "1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b", "name": "PT Contoh Baru", "subdomain": "contohbaru" },
    "expiresAt": "2026-10-10T03:14:07.000Z"
  }
}
```

`role` is the identifier from [01-conventions.md 1.11](01-conventions.md), not the display label. AC-40.01 renders "MEMBER" in the profile; that uppercasing is presentation. `avatarUrl` is nullable and the client renders initials when it is null.

**Errors.**

| code | status | condition |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Malformed email, missing password |
| `INVALID_CREDENTIALS` | 401 | Unknown email, wrong password, or a user belonging to another tenant. Message: `Email atau password salah` (AC-40.02) |
| `RATE_LIMITED` | 429 | More than 5 attempts in a minute |
| `NOT_FOUND` | 404 | Unknown subdomain |

**Traceability.** AC-40.01, AC-40.02. Enumeration hardening: [../technical-specs/07-security.md 7.1](../technical-specs/07-security.md).

## 2.3 POST /auth/logout

**Signature.** `POST /api/v1/auth/logout`

**Purpose.** End the current session. Triggered by the "Logout" item in the profile menu.

**Access.** Any authenticated principal, any role.

**Input.** No body. The session cookie identifies the row.

**Behavior.**

1. `identity.endSession(sessionId)` deletes the row. Deletion, not a flag, so revocation is total.
2. Clear the cookie with an expired `Set-Cookie`.
3. Write an `auth.logout` audit event.
4. Calling it twice is not an error. A request whose session is already gone returns `204` as well, so a double click on Logout does not surface a failure.

**Output.** `204 No Content`, plus a `Set-Cookie` that expires the cookie. The client routes to the Login screen (AC-40.03).

**Errors.** None specific. A request with no cookie still returns `204`.

**Traceability.** AC-40.03.

## 2.4 GET /auth/me

**Signature.** `GET /api/v1/auth/me`

**Purpose.** Resolve the current session into the principal the interface renders and derives its navigation from. Called on application boot and after any `401` recovery.

**Access.** Any authenticated principal, any role.

**Input.** None.

**Behavior.**

1. `identity.resolveSession(cookie)`. Reads the database, never a cache.
2. Evaluate absolute and idle expiry on read. Expired: `SESSION_EXPIRED` (AC-40.04).
3. Refresh `last_seen_at` if more than a minute has passed.
4. Compute `menus` from the role floor, so a menu cannot drift from the permission behind it ([../technical-specs/09-authentication-authorization.md 9.3.3](../technical-specs/09-authentication-authorization.md)).

**Output.** `200 OK`.

```json
{
  "data": {
    "user": {
      "id": "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10",
      "name": "Budi Santoso",
      "email": "budi@contohbaru.co.id",
      "role": "head_of_team",
      "avatarUrl": null
    },
    "tenant": { "id": "1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b", "name": "PT Contoh Baru", "subdomain": "contohbaru" },
    "menus": ["dashboard", "document", "permission_category", "audit_trail", "analytics"],
    "expiresAt": "2026-10-10T03:14:07.000Z"
  }
}
```

`menus` per role, mirroring AC-41.01 through AC-41.04:

| Role | `menus` |
|---|---|
| `member` | `dashboard`, `document` |
| `head_of_team` | plus `permission_category`, `audit_trail`, `analytics` |
| `admin_tenant` | plus `configuration` |
| `super_admin` | `tenant_management` only, and no document menus |

For a `super_admin`, `tenant` is `null`.

**The menu is presentation, not a control.** AC-41.05 asserts the server refuses an administration route regardless of what `menus` contains. Every guarded operation in this set declares its own floor; nothing consults this array.

**Errors.**

| code | status | condition |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No cookie sent |
| `SESSION_EXPIRED` | 401 | Absolute or idle expiry reached, or the row was deleted. Message: `Sesi Anda telah berakhir. Silakan login kembali` (AC-40.04) |

**Traceability.** AC-40.01, AC-40.04, AC-41.01, AC-41.02, AC-41.03, AC-41.04.

## 2.5 Session expiry during a long operation

AC-01.08 has a session expire while an upload is in flight. The upload operation ([05-documents.md 5.2](05-documents.md)) resolves the session before it reads a single byte and again before it commits, so an expired session yields `401 SESSION_EXPIRED` with the message above and no partial document, no quota consumed. The rule lives with the upload because the compensation is the upload's; it is named here so the session contract is complete in one place.

## 2.6 Authentication error codes

| code | status | condition | message |
|---|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Unknown email, wrong password, or wrong tenant | `Email atau password salah` |
| `SESSION_EXPIRED` | 401 | Session absent, expired or revoked | `Sesi Anda telah berakhir. Silakan login kembali` |
| `UNAUTHENTICATED` | 401 | No cookie at all | `Sesi Anda telah berakhir. Silakan login kembali` |

Standard codes are in [01-conventions.md 1.8](01-conventions.md).
