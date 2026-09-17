import { AppError, one } from "@archiva/shared";
import type { Context } from "hono";
import type { AppEnv } from "../middleware/context.ts";
import { requireRole } from "../middleware/guards.ts";
import {
  confirmClassification,
  correctFields,
  getProcessingStatus,
  listRelated,
  listUnconfirmed,
  replaceTags,
  reprocessDocument,
} from "./definitions/document-subresources.ts";
import {
  createBulkDownload,
  downloadDocument,
  fetchBulkDownload,
  getDocument,
  listDocuments,
  listVersions,
  previewDocument,
  uploadDocuments,
  uploadVersion,
} from "./definitions/documents.ts";
import {
  isDocumentInTenant,
  listOf,
  MOCK_BULK_TICKET,
  MOCK_CLASSIFIED_DOCUMENT,
  MOCK_DOCUMENT,
  MOCK_DOCUMENT_DETAIL,
  MOCK_PROCESSING,
  MOCK_RELATED,
  MOCK_REPROCESS,
  MOCK_UPLOAD_BATCH,
  MOCK_VERSION,
} from "./mocks.ts";
import { createRouter } from "./router.ts";

/**
 * 5.5, 5.9: A denied cross-tenant attempt writes an access.denied audit event
 * against the caller's own tenant with { attemptedId: id } in metadata, and
 * returns 404, never 403 (AC-43.03, AC-43.04).
 */
async function assertDocumentInTenant(c: Context<AppEnv>, documentId: string): Promise<void> {
  const tenant = c.get("tenant");
  const session = c.get("session");
  if (!isDocumentInTenant(documentId, tenant?.id ?? null)) {
    if (session.kind === "authenticated" && session.principal.tenantId !== null) {
      await c.get("activity").record({
        tenantId: session.principal.tenantId,
        actorId: session.principal.userId,
        action: "access.denied",
        subjectType: "document",
        subjectId: null,
        outcome: "denied",
        metadata: { attemptedId: documentId },
      });
    }
    throw new AppError("NOT_FOUND");
  }
}

/** api-specs/05-documents.md. Cards BE-S2-01, BE-S2-04, BE-S2-06, BE-S4-06, BE-S5-01, BE-S5-02. */
const router = createRouter()
  .openapi(listDocuments, (c) => c.json(listOf(MOCK_DOCUMENT), 200))
  // Static paths are registered before /{id} so they are not shadowed.
  .openapi(listUnconfirmed, (c) => c.json(listOf(MOCK_DOCUMENT), 200))
  .openapi(createBulkDownload, (c) => c.json(one(MOCK_BULK_TICKET), 200))
  .openapi(fetchBulkDownload, (c) =>
    c.body(new Uint8Array(), 200, { "Content-Type": "application/zip" }),
  )
  .openapi(getDocument, async (c) => {
    const { id } = c.req.valid("param");
    await assertDocumentInTenant(c, id);
    return c.json(one(MOCK_DOCUMENT_DETAIL), 200);
  })
  .openapi(listVersions, async (c) => {
    const { id } = c.req.valid("param");
    await assertDocumentInTenant(c, id);
    return c.json(listOf(MOCK_VERSION), 200);
  })
  .openapi(previewDocument, async (c) => {
    const { id } = c.req.valid("param");
    await assertDocumentInTenant(c, id);
    return c.body(new Uint8Array(), 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
    });
  })
  .openapi(downloadDocument, async (c) => {
    const { id } = c.req.valid("param");
    await assertDocumentInTenant(c, id);
    return c.body(new Uint8Array(), 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="kontrak-kerjasama.pdf"',
    });
  })
  .openapi(confirmClassification, async (c) => {
    const { id } = c.req.valid("param");
    await assertDocumentInTenant(c, id);
    return c.json(one(MOCK_CLASSIFIED_DOCUMENT), 200);
  })
  .openapi(getProcessingStatus, async (c) => {
    const { id } = c.req.valid("param");
    await assertDocumentInTenant(c, id);
    return c.json(one(MOCK_PROCESSING), 200);
  })
  .openapi(correctFields, async (c) => {
    const { id } = c.req.valid("param");
    await assertDocumentInTenant(c, id);
    return c.json(one(MOCK_DOCUMENT_DETAIL), 200);
  })
  .openapi(replaceTags, async (c) => {
    const { id } = c.req.valid("param");
    await assertDocumentInTenant(c, id);
    return c.json(one(MOCK_DOCUMENT_DETAIL), 200);
  })
  .openapi(reprocessDocument, async (c) => {
    const { id } = c.req.valid("param");
    await assertDocumentInTenant(c, id);
    return c.json(one(MOCK_REPROCESS), 202);
  })
  .openapi(listRelated, async (c) => {
    const { id } = c.req.valid("param");
    await assertDocumentInTenant(c, id);
    return c.json({ data: [MOCK_RELATED], meta: { total: 1 } }, 200);
  });

/**
 * 5.2 and 5.7 stream multipart bodies past every parser (01-conventions.md 1.2),
 * so they are documented through the registry and served without a body validator.
 */
router.openAPIRegistry.registerPath(uploadDocuments);
router.openAPIRegistry.registerPath(uploadVersion);
router.post("/", requireRole("member"), (c) => c.json(one(MOCK_UPLOAD_BATCH), 201));
router.post("/:id/versions", requireRole("member"), async (c) => {
  const id = c.req.param("id");
  await assertDocumentInTenant(c, id);
  return c.json(one(MOCK_DOCUMENT_DETAIL), 201);
});

export const documentRoutes = router;
