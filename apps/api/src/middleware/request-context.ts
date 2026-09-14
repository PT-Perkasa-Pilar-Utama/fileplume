import type { IdentityService, Principal } from "@archiva/identity";
import { SESSION_COOKIE_NAME } from "@archiva/identity";
import type { TenancyService, Tenant } from "@archiva/tenancy";
import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv, SessionState } from "./context.ts";
import { fail } from "./errors.ts";
import { ADMIN_SUBDOMAIN, subdomainOf } from "./internal/subdomain.ts";

export type RequestContextDeps = {
  tenancy: Pick<TenancyService, "resolveTenant">;
  identity: Pick<IdentityService, "resolveSession">;
  baseHost: string;
};

type Address = { kind: "tenant"; tenant: Tenant } | { kind: "admin" } | { kind: "unknown" };

async function resolveAddress(hostname: string, deps: RequestContextDeps): Promise<Address> {
  const subdomain = subdomainOf(hostname, deps.baseHost);
  if (subdomain === null) return { kind: "unknown" };
  if (subdomain === ADMIN_SUBDOMAIN) return { kind: "admin" };
  const tenant = await deps.tenancy.resolveTenant(subdomain);
  return tenant ? { kind: "tenant", tenant } : { kind: "unknown" };
}

async function resolveSessionState(
  token: string | undefined,
  identity: RequestContextDeps["identity"],
): Promise<SessionState> {
  if (token === undefined) return { kind: "absent" };
  const result = await identity.resolveSession(token);
  return result.ok ? { kind: "authenticated", principal: result.value } : { kind: "expired" };
}

/** A super_admin skips step 3 and is admitted only at step 4, to super_admin routes. */
function belongsTo(principal: Principal, tenant: Tenant | null): boolean {
  return principal.role === "super_admin" || principal.tenantId === (tenant?.id ?? null);
}

/**
 * Steps 1 to 3 of api-specs/01-conventions.md 1.12. Steps 4 and 5 belong to
 * the route. A mismatch at step 3 is 404, not 403, so a principal never learns
 * that another tenant exists.
 */
export function requestContext(deps: RequestContextDeps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set("requestId", crypto.randomUUID());

    const address = await resolveAddress(new URL(c.req.url).hostname, deps);
    if (address.kind === "unknown") return fail(c, "NOT_FOUND");
    const tenant = address.kind === "tenant" ? address.tenant : null;

    const session = await resolveSessionState(getCookie(c, SESSION_COOKIE_NAME), deps.identity);
    if (session.kind === "authenticated" && !belongsTo(session.principal, tenant)) {
      return fail(c, "NOT_FOUND");
    }

    c.set("tenant", tenant);
    c.set("session", session);
    await next();
  };
}
