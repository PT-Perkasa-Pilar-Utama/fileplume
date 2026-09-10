import { Hono } from "hono";
import type { AppEnv } from "../middleware/context.ts";
import { requireRole } from "../middleware/guards.ts";
import { MOCK_META, one } from "./mocks.ts";

const AUDIT_ROW = {
  id: "10241",
  action: "document.download" as const,
  actionLabel: "Unduhan ditolak",
  outcome: "denied" as const,
  actor: { id: "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", name: "Zayd Almasi" },
  subject: {
    type: "document",
    id: "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
    title: "offering-letter.pdf",
  },
  metadata: { reason: "DOWNLOAD_FORBIDDEN" },
  createdAt: "2026-09-10T05:41:12.000Z",
};

/** api-specs/09-activity.md. Cards BE-S5-04, BE-S5-05. */
export const auditRoutes = new Hono<AppEnv>().get("/", requireRole("head_of_team"), (c) =>
  c.json({ data: [AUDIT_ROW], meta: MOCK_META }),
);

export const analyticsRoutes = new Hono<AppEnv>().get(
  "/dashboard",
  requireRole("head_of_team"),
  (c) =>
    c.json(
      one({
        volume: { totalDocuments: 412, uploadedLast7Days: 23 },
        retrieval: {
          searchesLast7Days: 187,
          zeroResultRatePercent: 12.3,
          documentsOpenedLast7Days: 96,
        },
        aiQuality: {
          categoryOverrideRatePercent: 8.1,
          fieldOverrideRatePercent: 4.7,
          sampleSize: 149,
        },
        generatedAt: "2026-09-10T06:00:00.000Z",
        message: null,
      }),
    ),
);
