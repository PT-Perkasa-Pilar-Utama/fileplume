import { Hono } from "hono";
import type { AppEnv } from "../middleware/context.ts";
import { requireRole } from "../middleware/guards.ts";

/** api-specs/07-enrichment.md 7.7. Card BE-S3-06. */
export const tagRoutes = new Hono<AppEnv>().get("/top", requireRole("member"), (c) =>
  c.json({
    data: [
      { tag: "strategy", documentCount: 42 },
      { tag: "legal", documentCount: 31 },
    ],
    meta: { total: 2 },
  }),
);
