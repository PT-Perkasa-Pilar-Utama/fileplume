import { Hono } from "hono";
import type { AppEnv } from "../middleware/context.ts";
import { MOCK_TENANT, MOCK_USER, one } from "./mocks.ts";

/** api-specs/02-authentication.md. Cards BE-S1-02, FE-S1-05. */
export const authRoutes = new Hono<AppEnv>()
  // 2.2
  .post("/login", (c) =>
    c.json(one({ user: MOCK_USER, tenant: MOCK_TENANT, expiresAt: "2026-10-10T03:14:07.000Z" })),
  )
  // 2.3
  .post("/logout", (c) => c.body(null, 204))
  // 2.4
  .get("/me", (c) =>
    c.json(
      one({
        user: MOCK_USER,
        tenant: MOCK_TENANT,
        menus: ["dashboard", "document"],
        expiresAt: "2026-10-10T03:14:07.000Z",
      }),
    ),
  );
