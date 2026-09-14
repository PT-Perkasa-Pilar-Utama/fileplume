import { one } from "@archiva/shared";
import { Hono } from "hono";
import type { AppEnv } from "../middleware/context.ts";
import { requireRole } from "../middleware/guards.ts";
import { listOf } from "./mocks.ts";

const MOCK_TENANT_ROW = {
  id: "1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b",
  name: "PT Contoh Baru",
  subdomain: "contohbaru",
  status: "active" as const,
  storageQuotaBytes: 53687091200,
  storageUsedBytes: 13421772800,
  storagePercent: 25,
  documentCount: 412,
  userCount: 9,
  createdAt: "2026-09-10T02:11:44.000Z",
};

/** api-specs/03-tenants.md. Served on the reserved admin subdomain. Card BE-S1-01. */
export const tenantRoutes = new Hono<AppEnv>()
  // 3.1
  .post("/", requireRole("super_admin"), (c) => c.json(one(MOCK_TENANT_ROW), 201))
  // 3.2
  .get("/", requireRole("super_admin"), (c) => c.json(listOf(MOCK_TENANT_ROW)))
  // 3.3
  .patch("/:tenantId/quota", requireRole("super_admin"), (c) => c.json(one(MOCK_TENANT_ROW)));
