import {
  classificationBody,
  classifiedDocumentSchema,
  collectionOf,
  correctFieldsBody,
  dataOf,
  documentDetailSchema,
  documentSchema,
  idParams,
  processingStatusSchema,
  relatedDocumentSchema,
  relatedQuery,
  replaceTagsBody,
  reprocessAcceptedSchema,
  unconfirmedDocumentsQuery,
} from "@archiva/shared";
import { createRoute } from "@hono/zod-openapi";
import { requireRole } from "../../middleware/guards.ts";
import {
  ERROR_404,
  ERROR_409,
  ERROR_422,
  ERROR_503,
  GUARDED,
  json,
  jsonBody,
  SESSION,
} from "./responses.ts";

/** api-specs/06-categories.md 6.6. Ownership is decided by the service. */
export const confirmClassification = createRoute({
  method: "put",
  path: "/{id}/classification",
  tags: ["Categories"],
  summary: "Confirm or replace a document's suggested category",
  security: SESSION,
  middleware: requireRole("member"),
  request: { params: idParams, body: jsonBody(classificationBody) },
  responses: {
    200: json(dataOf(classifiedDocumentSchema), "The confirmed document"),
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_422,
  },
});

/** 6.8. A distinct operation so the floor is declared at registration. */
export const listUnconfirmed = createRoute({
  method: "get",
  path: "/unconfirmed",
  tags: ["Categories"],
  summary: "The review queue of documents awaiting a category",
  security: SESSION,
  middleware: requireRole("head_of_team"),
  request: { query: unconfirmedDocumentsQuery },
  responses: {
    200: json(collectionOf(documentSchema), "A page of unconfirmed documents"),
    ...GUARDED,
    ...ERROR_422,
  },
});

/** api-specs/07-enrichment.md 7.2. A malware deletion answers 404. */
export const getProcessingStatus = createRoute({
  method: "get",
  path: "/{id}/processing",
  tags: ["Enrichment"],
  summary: "Poll a document's processing state",
  security: SESSION,
  middleware: requireRole("member"),
  request: { params: idParams },
  responses: {
    200: json(dataOf(processingStatusSchema), "The processing state"),
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_422,
  },
});

/** 7.4. */
export const correctFields = createRoute({
  method: "patch",
  path: "/{id}/fields",
  tags: ["Enrichment"],
  summary: "Correct values the AI produced",
  security: SESSION,
  middleware: requireRole("member"),
  request: { params: idParams, body: jsonBody(correctFieldsBody) },
  responses: {
    200: json(dataOf(documentDetailSchema), "The corrected document"),
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_422,
  },
});

/** 7.5. */
export const replaceTags = createRoute({
  method: "put",
  path: "/{id}/tags",
  tags: ["Enrichment"],
  summary: "Replace a document's tag set",
  security: SESSION,
  middleware: requireRole("member"),
  request: { params: idParams, body: jsonBody(replaceTagsBody) },
  responses: {
    200: json(dataOf(documentDetailSchema), "The retagged document"),
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_422,
  },
});

/** 7.6. Only from `failed` or `ready`. */
export const reprocessDocument = createRoute({
  method: "post",
  path: "/{id}/reprocess",
  tags: ["Enrichment"],
  summary: "Send a document back through the pipeline",
  security: SESSION,
  middleware: requireRole("head_of_team"),
  request: { params: idParams },
  responses: {
    202: json(dataOf(reprocessAcceptedSchema), "Queued"),
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_409,
    ...ERROR_422,
  },
});

/** api-specs/08-search.md 8.4. Writes no search.performed event. */
export const listRelated = createRoute({
  method: "get",
  path: "/{id}/related",
  tags: ["Search"],
  summary: "At most five documents sharing a category or a tag",
  security: SESSION,
  middleware: requireRole("member"),
  request: { params: idParams, query: relatedQuery },
  responses: {
    200: json(collectionOf(relatedDocumentSchema), "Related documents"),
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_422,
    ...ERROR_503,
  },
});
