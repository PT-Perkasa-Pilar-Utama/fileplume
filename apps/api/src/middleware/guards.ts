import { hasRoleAtLeast, type Role } from "@archiva/shared";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./context.ts";
import { fail } from "./errors.ts";

/**
 * A floor, not a set. The argument is required, so a route registered without
 * one fails to compile. api-specs/01-conventions.md 1.11.
 */
export function requireRole(floor: Role): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const principal = c.get("principal");
    if (!principal) return fail(c, "UNAUTHENTICATED");
    if (!hasRoleAtLeast(principal.role, floor)) {
      // Every 403 writes a denied audit event before the response is sent.
      // Wired to activity.record in BE-S1-03.
      return fail(c, "FORBIDDEN");
    }
    await next();
  };
}

/**
 * The five-step order in api-specs/01-conventions.md 1.12. Step 3 returns 404,
 * not 403, so an id in another tenant is never confirmed to exist.
 */
export const resolveTenantAndSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  // SCAFFOLD: real subdomain and cookie resolution lands in BE-S1-02 and BE-S1-03.
  c.set("tenantId", "1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b");
  c.set("principal", {
    userId: "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10",
    tenantId: "1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b",
    role: "member",
    sessionId: "00000000-0000-4000-8000-000000000000",
  });
  await next();
};
