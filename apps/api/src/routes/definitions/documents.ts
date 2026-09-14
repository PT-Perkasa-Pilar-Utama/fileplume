import {
  bulkDownloadBody,
  bulkDownloadTicketSchema,
  collectionOf,
  dataOf,
  documentDetailSchema,
  documentSchema,
  documentVersionSchema,
  downloadDocumentBody,
  idempotencyHeaders,
  idParams,
  listDocumentsQuery,
  previewQuery,
  ticketParams,
  uploadBatchSchema,
  uploadDocumentsForm,
  uploadVersionForm,
} from "@archiva/shared";
import { createRoute } from "@hono/zod-openapi";
import { requireRole } from "../../middleware/guards.ts";
import {
  binary,
  ERROR_400,
  ERROR_404,
  ERROR_409,
  ERROR_413,
  ERROR_422,
  ERROR_429,
  ERROR_503,
  GUARDED,
  json,
  jsonBody,
  multipartBody,
  SESSION,
} from "./responses.ts";

const tags = ["Documents"];
const middleware = requireRole("member");

/** api-specs/05-documents.md 5.2. Documentation only; see routes/documents.ts. */
export const uploadDocuments = createRoute({
  method: "post",
  path: "/",
  tags,
  summary: "Upload one to twenty files, with a per-file outcome",
  security: SESSION,
  request: { body: multipartBody(uploadDocumentsForm) },
  responses: {
    201: json(dataOf(uploadBatchSchema), "At least one file was accepted"),
    ...ERROR_400,
    ...GUARDED,
    ...ERROR_413,
    ...ERROR_422,
    ...ERROR_429,
  },
});

/** 5.4. Scoped by the confirmation-window predicate in 5.4.1. */
export const listDocuments = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List documents, with category, tag and state filters",
  security: SESSION,
  middleware,
  request: { query: listDocumentsQuery },
  responses: {
    200: json(collectionOf(documentSchema), "A page of documents"),
    ...GUARDED,
    ...ERROR_422,
  },
});

/** 5.5. Another tenant's id is 404, never 403. */
export const getDocument = createRoute({
  method: "get",
  path: "/{id}",
  tags,
  summary: "Read a document with its metadata and versions",
  security: SESSION,
  middleware,
  request: { params: idParams },
  responses: {
    200: json(dataOf(documentDetailSchema), "The document"),
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_422,
  },
});

/** 5.6. Newest first. */
export const listVersions = createRoute({
  method: "get",
  path: "/{id}/versions",
  tags,
  summary: "List a document's versions",
  security: SESSION,
  middleware,
  request: { params: idParams },
  responses: {
    200: json(collectionOf(documentVersionSchema), "The versions"),
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_422,
  },
});

/** 5.7. Documentation only; see routes/documents.ts. */
export const uploadVersion = createRoute({
  method: "post",
  path: "/{id}/versions",
  tags,
  summary: "Add a revision to a named document",
  security: SESSION,
  request: { params: idParams, body: multipartBody(uploadVersionForm) },
  responses: {
    201: json(dataOf(documentDetailSchema), "Version added"),
    ...ERROR_400,
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_409,
    ...ERROR_413,
    ...ERROR_422,
    ...ERROR_429,
  },
});

/** 5.8. Not gated by the category download permission. */
export const previewDocument = createRoute({
  method: "get",
  path: "/{id}/preview",
  tags,
  summary: "Stream renderable PDF bytes for the viewer",
  security: SESSION,
  middleware,
  request: { params: idParams, query: previewQuery },
  responses: {
    200: binary("application/pdf", "The stored PDF, or a Gotenberg conversion"),
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_422,
    ...ERROR_503,
  },
});

/** 5.9. POST because every outcome writes an audit row. */
export const downloadDocument = createRoute({
  method: "post",
  path: "/{id}/download",
  tags,
  summary: "Stream the original file and record the access",
  security: SESSION,
  middleware,
  request: {
    params: idParams,
    headers: idempotencyHeaders,
    body: jsonBody(downloadDocumentBody, false),
  },
  responses: {
    200: binary("application/octet-stream", "The original bytes, with the stored MIME type"),
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_422,
  },
});

/** 5.10. Omits what the caller may not have rather than failing the selection. */
export const createBulkDownload = createRoute({
  method: "post",
  path: "/download-bulk",
  tags,
  summary: "Package a selection into a download ticket",
  security: SESSION,
  middleware,
  request: { body: jsonBody(bulkDownloadBody) },
  responses: {
    200: json(dataOf(bulkDownloadTicketSchema), "The ticket and what was omitted"),
    ...GUARDED,
    ...ERROR_422,
  },
});

/** 5.11. Only the principal who created the ticket may fetch it. */
export const fetchBulkDownload = createRoute({
  method: "get",
  path: "/download-bulk/{ticketId}",
  tags,
  summary: "Stream the archive a ticket describes",
  security: SESSION,
  middleware,
  request: { params: ticketParams },
  responses: {
    200: binary("application/zip", "The archive"),
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_422,
  },
});
