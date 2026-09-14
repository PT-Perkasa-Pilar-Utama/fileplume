import { one } from "@archiva/shared";
import { Hono } from "hono";
import type { AppEnv } from "../middleware/context.ts";
import { requireRole } from "../middleware/guards.ts";
import { MOCK_TENANT, MOCK_USER } from "./mocks.ts";

/** api-specs/02-authentication.md. Cards BE-S1-02, FE-S1-05. */
export const authRoutes = new Hono<AppEnv>()
  // 2.2. Public: the only tenant-scoped operation reachable without a session.
  .post("/login", (c) =>
    c.json(one({ user: MOCK_USER, tenant: MOCK_TENANT, expiresAt: "2026-10-10T03:14:07.000Z" })),
  )
  // 2.3
  .post("/logout", requireRole("authenticated"), (c) => c.body(null, 204))
  // 2.4
  .get("/me", requireRole("authenticated"), (c) =>
    c.json(
      one({
        user: MOCK_USER,
        tenant: MOCK_TENANT,
        menus: ["dashboard", "document"],
        expiresAt: "2026-10-10T03:14:07.000Z",
      }),
    ),
  );
