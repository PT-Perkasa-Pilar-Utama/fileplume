import { one } from "@archiva/shared";
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

/** api-specs/05-documents.md. Cards BE-S2-01, BE-S2-04, BE-S2-06, BE-S4-06, BE-S5-01, BE-S5-02. */
const router = createRouter()
  .openapi(listDocuments, (c) => c.json(listOf(MOCK_DOCUMENT), 200))
  // Static paths are registered before /{id} so they are not shadowed.
  .openapi(listUnconfirmed, (c) => c.json(listOf(MOCK_DOCUMENT), 200))
  .openapi(createBulkDownload, (c) => c.json(one(MOCK_BULK_TICKET), 200))
  .openapi(fetchBulkDownload, (c) =>
    c.body(new Uint8Array(), 200, { "Content-Type": "application/zip" }),
  )
  .openapi(getDocument, (c) => c.json(one(MOCK_DOCUMENT_DETAIL), 200))
  .openapi(listVersions, (c) => c.json(listOf(MOCK_VERSION), 200))
  .openapi(previewDocument, (c) =>
    c.body(new Uint8Array(), 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
    }),
  )
  .openapi(downloadDocument, (c) =>
    c.body(new Uint8Array(), 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="kontrak-kerjasama.pdf"',
    }),
  )
  .openapi(confirmClassification, (c) => c.json(one(MOCK_CLASSIFIED_DOCUMENT), 200))
  .openapi(getProcessingStatus, (c) => c.json(one(MOCK_PROCESSING), 200))
  .openapi(correctFields, (c) => c.json(one(MOCK_DOCUMENT_DETAIL), 200))
  .openapi(replaceTags, (c) => c.json(one(MOCK_DOCUMENT_DETAIL), 200))
  .openapi(reprocessDocument, (c) => c.json(one(MOCK_REPROCESS), 202))
  .openapi(listRelated, (c) => c.json({ data: [MOCK_RELATED], meta: { total: 1 } }, 200));

/**
 * 5.2 and 5.7 stream multipart bodies past every parser (01-conventions.md 1.2),
 * so they are documented through the registry and served without a body validator.
 */
router.openAPIRegistry.registerPath(uploadDocuments);
router.openAPIRegistry.registerPath(uploadVersion);
router.post("/", requireRole("member"), (c) => c.json(one(MOCK_UPLOAD_BATCH), 201));
router.post("/:id/versions", requireRole("member"), (c) => c.json(one(MOCK_DOCUMENT_DETAIL), 201));

export const documentRoutes = router;
