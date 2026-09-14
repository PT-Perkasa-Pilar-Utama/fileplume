import { hasRoleAtLeast, type Role } from "@archiva/shared";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./context.ts";
import { fail } from "./errors.ts";

/**
 * A role floor, or `authenticated` for the operations every principal reaches
 * whatever its role (api-specs/02-authentication.md 2.3, 2.4). `member` cannot
 * stand in for it, because super_admin sits outside the tenant chain.
 */
export type Floor = Role | "authenticated";

/**
 * A floor, not a set. The argument is required, so a route registered without
 * one fails to compile. api-specs/01-conventions.md 1.11, step 4 of 1.12.
 */
export function requireRole(floor: Floor): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const session = c.get("session");
    if (session.kind === "absent") return fail(c, "UNAUTHENTICATED");
    if (session.kind === "expired") return fail(c, "SESSION_EXPIRED");
    if (floor !== "authenticated" && !hasRoleAtLeast(session.principal.role, floor)) {
      // Every 403 writes a denied audit event before the response is sent.
      // Wired to activity.record in BE-S1-03.
      return fail(c, "FORBIDDEN");
    }
    c.set("principal", session.principal);
    await next();
  };
}
