# 07 — Security

**Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Engineering  
**Status:** Approved  
**Phase:** Release 1  

The governing principle: **a hidden control is not a security measure.** Grooming D14 recorded that AC-10.02 and the US-41 criteria, as originally written, passed on a system anyone could exploit with developer tools open. Every rule below is enforced server-side and tested by asserting a 403, never by asserting that a button is disabled.

## 7.1 Authentication

| Concern | Implementation |
|---|---|
| Mechanism | Email and password via better-auth |
| Hashing | Argon2id through `Bun.password`, cost parameters reviewed yearly |
| Session store | `sessions` table, token hashed at rest, raw token only in the cookie |
| Cookie | `httpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefix |
| Absolute expiry | 30 days |
| Idle expiry | 8 hours on `last_seen_at`, evaluated on read (AC-40.04) |
| Failed login | Same message and same timing for unknown email and wrong password (AC-40.02) |
| Enumeration | Registration is admin-driven in release 1, so there is no public signup surface |

Sessions are read from the database on every request. That is the cost of AC-14.02's "sejak saat itu": a revoked permission or an ended session takes effect on the next request, which no stateless token can promise.

## 7.2 Authorization

Three checks, composed, never collapsed.

| Check | Owner | Question |
|---|---|---|
| Tenant scope | `tenancy` middleware | Does this row belong to the caller's tenant? |
| Role floor | `identity.requireRole` | Does the caller's role reach the floor this route declares? |
| Category permission | `classification.canDownloadCategory` | Is this category downloadable right now? |

Every route declares its floor at registration. A route with no declared floor fails to compile, because the router helper requires the argument.

| Criterion | Server-side assertion |
|---|---|
| AC-10.03 | Direct `GET /documents/:id/download` on an Inactive category returns 403 and writes a denied audit event |
| AC-14.03 | Member Team calling the permission endpoint returns 403, permission unchanged, event written |
| AC-41.05 | Member Team calling any admin route returns 403, no data in the body |
| AC-43.03 | Cross-tenant document id returns **404, not 403**, so existence does not leak |
| AC-47.03 | Non-owner Member Team calling the override endpoint returns 403, value unchanged |

The 404-versus-403 distinction is deliberate. Inside your tenant, a refusal tells you the thing exists and you may not have it. Across tenants, a refusal must not confirm that an id is real.

## 7.3 Tenant isolation

Enforced at the data access layer, not by remembering to write a `WHERE` clause.

- Every tenant-owned table carries `tenant_id` as the first column of its primary index.
- Repository helpers take a `TenantId` as a required first argument. A query that omits it does not typecheck.
- OpenSearch queries are built only inside `packages/search`, which applies the tenant filter itself. Callers pass a query string, never a query body.
- Blob keys are prefixed `t/<tenant_id>/`, and the S3 adapter refuses a key whose prefix does not match the active tenant.
- An integration suite seeds two tenants and attempts cross-access by direct id on every read path.

## 7.4 Request hardening

| Concern | Implementation |
|---|---|
| Security headers | `hono/secure-headers`: HSTS with preload, nosniff, frame denial, Referrer-Policy `strict-origin-when-cross-origin` |
| CSP | `default-src 'self'`, `img-src 'self' blob: data:`, `object-src 'none'`, `frame-ancestors 'none'`. No inline script; Vite emits hashed bundles. |
| CORS | Single allowed origin from `WEB_ORIGIN`, credentials true. No wildcard, ever. |
| CSRF | `SameSite=Lax` plus an origin check on every mutating request |
| Body limits | 1 MB JSON. Uploads bypass the JSON parser and stream, bounded by `max_file_size_mb`. |
| Rate limits | Login 5 per minute per IP and per email. Search 60 per minute per session. Upload 100 per hour per user. Reset-state 1 per minute. |
| Input validation | Zod on every route. Unvalidated body access is a lint error. |
| SQL injection | Drizzle parameterises. Raw SQL requires a review comment naming why. |
| Error responses | Typed error codes, never a stack trace, never a driver message |

## 7.5 File and object handling

| Concern | Implementation |
|---|---|
| Malware | ClamAV scans before extraction and before the document is visible to anyone but its uploader. Infected: blob deleted, document deleted, `malware.detected` event (AC-46.02). |
| Type validation | Magic-byte sniffing, not the filename extension and not the client-supplied MIME type |
| Download response | `Content-Disposition: attachment`, nosniff, filename sanitised |
| Preview | PDFs render in `pdf.js` in a worker; Office formats are converted by Gotenberg and returned as PDF. The browser never executes document content. |
| Object store access | Private bucket, no public URL. Downloads stream through the API so the permission check and the audit event cannot be bypassed. |
| Path traversal | Blob keys are generated from uuids, never from user-supplied filenames |

Streaming downloads through the API rather than issuing pre-signed URLs is a deliberate cost. A pre-signed URL would be cheaper and would also make AC-10.03 and AC-13.02 unenforceable, because the object store cannot consult a category permission or write to the audit ledger.

## 7.6 Operational endpoint policy

### 7.6.1 Health

`/health/live` is public. Liveness only, no dependency detail, safe for an unauthenticated load balancer poll.

`/health/ready` requires `Authorization: Bearer <HEALTH_TOKEN>`. Its per-dependency breakdown names internal topology and reports queue depth and index lag, which is reconnaissance material.

### 7.6.2 Reset database state

**Rule: the route is mounted only in `dev`, `test`, `sit` and `uat`. In production it does not exist.**

```ts
// apps/api/src/index.ts
if (config.APP_ENV !== "production" && config.ENABLE_RESET_API) {
  app.route("/admin", resetStateRoutes);
}
```

Enforced at route registration, not by an authorization check inside a handler. The distinction matters: an authorization check is code that can be misconfigured, and a route that exists is a route that can be reached. In production the branch never runs, the handler is never registered, and the path returns the same 404 as any unknown URL.

Belt and braces on top of that, in the environments where it does exist:

1. `Authorization: Bearer <RESET_API_TOKEN>`, a distinct token from `HEALTH_TOKEN`.
2. A `confirm` field that must equal `reset-<APP_ENV>`, so a request captured from SIT cannot be replayed against UAT.
3. Every invocation writes an `admin.reset_state` audit event before it starts.
4. CI asserts, as a test, that a production-configured app returns 404 for `POST /admin/reset-state`.

Point 4 is the one that holds the line. The rule is only real if a test fails when someone breaks it.

## 7.7 Secrets

| Concern | Implementation |
|---|---|
| Storage | Environment variables injected by the orchestrator. No secret in the image, none in the repository. |
| Local | `.env.local`, gitignored. `.env.example` lists every key with placeholder values. |
| Validation | `packages/config` parses the environment at startup with Zod and exits non-zero on a missing or malformed secret. The process never starts half-configured. |
| Rotation | Session secret, `HEALTH_TOKEN` and `RESET_API_TOKEN` quarterly. AI provider keys on staff change. |
| Logging | Secret keys are marked in `packages/config` and redacted by the pino serialiser. Authorization headers and cookies are redacted at the request logger. |

## 7.8 Threat surface

| Threat | Mitigation | Residual |
|---|---|---|
| Cross-tenant data access | 7.3, tested by direct-id attempts on every read path | Low |
| Download of a restricted category | Server-side predicate, streamed download, audited denial | Low |
| Malware distribution via the archive | ClamAV before visibility, private bucket, attachment disposition | Signature lag on a novel sample |
| Credential stuffing | Rate limit per IP and per email, Argon2id, uniform failure response | No MFA in release 1, flagged for release 2 |
| Session theft | httpOnly, Secure, SameSite, database-backed revocation | XSS would still expose the session; CSP is the compensating control |
| Prompt injection via document content | Document text is passed as data in a structured prompt and the response is parsed against a Zod schema. A category outside the tenant's taxonomy is rejected, not created. | A crafted document can bias its own classification. It cannot escalate privilege or create a category. |
| Content leaving the tenant boundary | Provider abstraction (grooming D8), on-premises adapter available | Open commercial question: which provider, under what retention terms |
| Reset-state reachable in production | Route not registered, plus a CI test asserting 404 | Low |
| Denial of service via bulk download | 50-document cap (AC-11.03), rate limit, streamed zip | Large legitimate zips still consume egress |
