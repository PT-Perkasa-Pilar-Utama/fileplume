import type { IdentityService } from "@archiva/identity";
import { SESSION_COOKIE_NAME } from "@archiva/identity";
import { AppError, one } from "@archiva/shared";
import { deleteCookie, setCookie } from "hono/cookie";
import { login, logout, me } from "./definitions/auth.ts";
import { deriveMenus } from "./internal/menus.ts";
import { createRouter } from "./router.ts";

/**
 * api-specs/02-authentication.md. Card BE-S1-02.
 * Handlers validate inputs, call identity service, and map envelopes.
 */
export function authRoutes(identity: IdentityService) {
  return createRouter()
    .openapi(login, async (c) => {
      const { email, password } = c.req.valid("json");
      const tenant = c.get("tenant");
      const tenantId = tenant ? tenant.id : null;

      const result = await identity.authenticate(email, password, tenantId);
      if (!result.ok) {
        throw new AppError("INVALID_CREDENTIALS");
      }

      const session = result.value;
      setCookie(c, SESSION_COOKIE_NAME, session.token, {
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        path: "/",
        expires: session.expiresAt,
      });

      const tenantRef = tenant
        ? { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain }
        : null;

      return c.json(
        one({
          user: {
            id: session.principal.userId,
            name: session.principal.name,
            email: session.principal.email,
            role: session.principal.role,
            avatarUrl: session.principal.avatarUrl,
          },
          tenant: tenantRef,
          expiresAt: session.expiresAt.toISOString(),
        }),
        200,
      );
    })
    .openapi(logout, async (c) => {
      const session = c.get("session");
      if (session.kind === "authenticated") {
        await identity.endSession(session.principal.sessionId);
      }
      deleteCookie(c, SESSION_COOKIE_NAME, {
        path: "/",
        secure: true,
      });
      return c.body(null, 204);
    })
    .openapi(me, (c) => {
      const principal = c.get("principal");
      const tenant = c.get("tenant");
      const tenantRef = tenant
        ? { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain }
        : null;

      return c.json(
        one({
          user: {
            id: principal.userId,
            name: principal.name,
            email: principal.email,
            role: principal.role,
            avatarUrl: principal.avatarUrl,
          },
          tenant: tenantRef,
          menus: deriveMenus(principal.role),
          expiresAt: principal.expiresAt.toISOString(),
        }),
        200,
      );
    });
}
