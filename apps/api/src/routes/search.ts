import { Hono } from "hono";
import type { AppEnv } from "../middleware/context.ts";
import { requireRole } from "../middleware/guards.ts";
import { MOCK_DOCUMENT, MOCK_META } from "./mocks.ts";

const TITLE_HIT = {
  documentId: MOCK_DOCUMENT.id,
  title: "kontrak-kerjasama.pdf",
  fileType: "pdf" as const,
  fragment: "kontrak <em>kerjasama</em> antara PT Contoh Baru dan ...",
  uploader: MOCK_DOCUMENT.uploader,
  category: { id: MOCK_DOCUMENT.category.id, name: MOCK_DOCUMENT.category.name },
  createdAt: "2026-09-01T09:00:00.000Z",
  score: 8.42,
};

const CONTENT_HIT = {
  documentId: MOCK_DOCUMENT.id,
  title: "kontrak-kerjasama.pdf",
  fileType: "pdf" as const,
  pageNumber: 15,
  fragment: "... tunduk pada <em>klausul-kerahasiaan</em> sebagaimana diatur ...",
  matchCount: 3,
  uploader: MOCK_DOCUMENT.uploader,
  score: 12.07,
};

/** api-specs/08-search.md. Cards BE-S4-02, BE-S4-03. */
export const searchRoutes = new Hono<AppEnv>()
  // 8.2
  .get("/titles", requireRole("member"), (c) => c.json({ data: [TITLE_HIT], meta: MOCK_META }))
  // 8.3
  .get("/content", requireRole("member"), (c) => c.json({ data: [CONTENT_HIT], meta: MOCK_META }));
