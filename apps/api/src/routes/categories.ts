import { one } from "@archiva/shared";
import { Hono } from "hono";
import type { AppEnv } from "../middleware/context.ts";
import { requireRole } from "../middleware/guards.ts";
import { listOf, MOCK_CATEGORY } from "./mocks.ts";

/** api-specs/06-categories.md. Cards BE-S3-03, BE-S5-03, FE-S3-02, FE-S5-03. */
export const categoryRoutes = new Hono<AppEnv>()
  // 6.2
  .get("/", requireRole("member"), (c) => c.json(listOf(MOCK_CATEGORY)))
  // 6.3, a new category is always Inactive
  .post("/", requireRole("head_of_team"), (c) =>
    c.json(one({ ...MOCK_CATEGORY, downloadActive: false }), 201),
  )
  // 6.4
  .patch("/:id", requireRole("head_of_team"), (c) => c.json(one(MOCK_CATEGORY)))
  // 6.5
  .put("/:id/download-permission", requireRole("head_of_team"), (c) =>
    c.json(one({ ...MOCK_CATEGORY, downloadActive: true })),
  );
