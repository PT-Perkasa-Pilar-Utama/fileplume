import { Hono } from "hono";
import type { AppEnv } from "../middleware/context.ts";
import { requireRole } from "../middleware/guards.ts";
import { listOf, MOCK_DOCUMENT, MOCK_DOCUMENT_DETAIL, MOCK_VERSION, one } from "./mocks.ts";

/** api-specs/05-documents.md. Cards BE-S2-01, BE-S2-04, BE-S2-06, BE-S4-06, BE-S5-01, BE-S5-02. */
export const documentRoutes = new Hono<AppEnv>()
  // 5.2 batch upload, per-file outcomes
  .post("/", requireRole("member"), (c) =>
    c.json(
      one({
        accepted: 1,
        rejected: 0,
        summary: null,
        results: [
          {
            index: 0,
            filename: "laporan-q3.pdf",
            status: "accepted" as const,
            document: {
              id: MOCK_DOCUMENT.id,
              title: "laporan-q3.pdf",
              processingState: "queued" as const,
              processingLabel: "Antre",
            },
          },
        ],
      }),
      201,
    ),
  )
  // 5.4
  .get("/", requireRole("member"), (c) => c.json(listOf(MOCK_DOCUMENT)))
  // 06-categories.md 6.8, registered before /:id so it is not shadowed
  .get("/unconfirmed", requireRole("head_of_team"), (c) => c.json(listOf(MOCK_DOCUMENT)))
  // 5.10
  .post("/download-bulk", requireRole("member"), (c) =>
    c.json(
      one({
        ticketId: "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b",
        downloadUrl: "/api/v1/documents/download-bulk/e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b",
        expiresAt: "2026-09-10T04:35:00.000Z",
        includedCount: 1,
        omittedCount: 0,
        omitted: [],
        message: null,
      }),
    ),
  )
  // 5.11
  .get("/download-bulk/:ticketId", requireRole("member"), (c) =>
    c.body(new Uint8Array(), 200, { "Content-Type": "application/zip" }),
  )
  // 5.5
  .get("/:id", requireRole("member"), (c) => c.json(one(MOCK_DOCUMENT_DETAIL)))
  // 5.6
  .get("/:id/versions", requireRole("member"), (c) => c.json(listOf(MOCK_VERSION)))
  // 5.7
  .post("/:id/versions", requireRole("member"), (c) => c.json(one(MOCK_DOCUMENT_DETAIL), 201))
  // 5.8
  .get("/:id/preview", requireRole("member"), (c) =>
    c.body(new Uint8Array(), 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
    }),
  )
  // 5.9
  .post("/:id/download", requireRole("member"), (c) =>
    c.body(new Uint8Array(), 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="kontrak-kerjasama.pdf"',
    }),
  )
  // 06-categories.md 6.6
  .put("/:id/classification", requireRole("member"), (c) => c.json(one(MOCK_DOCUMENT_DETAIL)))
  // 07-enrichment.md 7.2
  .get("/:id/processing", requireRole("member"), (c) =>
    c.json(
      one({
        documentId: MOCK_DOCUMENT.id,
        state: "ready" as const,
        label: "Siap",
        failureReason: null,
        searchable: true,
        updatedAt: "2026-09-10T05:20:44.000Z",
      }),
    ),
  )
  // 07-enrichment.md 7.4
  .patch("/:id/fields", requireRole("member"), (c) => c.json(one(MOCK_DOCUMENT_DETAIL)))
  // 07-enrichment.md 7.5
  .put("/:id/tags", requireRole("member"), (c) => c.json(one(MOCK_DOCUMENT_DETAIL)))
  // 07-enrichment.md 7.6
  .post("/:id/reprocess", requireRole("head_of_team"), (c) =>
    c.json(one({ documentId: MOCK_DOCUMENT.id, state: "queued", label: "Antre" }), 202),
  )
  // 08-search.md 8.4
  .get("/:id/related", requireRole("member"), (c) =>
    c.json({
      data: [
        {
          documentId: "3c7e5b21-9a04-4d18-b6f2-8e0a1c2d3e4f",
          title: "technical-proposal-test.pdf",
          fileType: "pdf",
          uploader: MOCK_DOCUMENT.uploader,
          sharedCategory: true,
          sharedTags: ["legal"],
          score: 4.11,
        },
      ],
      meta: { total: 1 },
    }),
  );
