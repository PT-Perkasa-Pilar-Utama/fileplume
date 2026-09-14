import { z } from "zod";
import {
  booleanQuery,
  personRefSchema,
  repeatedQuery,
  sortableQuery,
  timestampSchema,
} from "./common.ts";
import { FAILURE_REASONS, FILE_TYPES, PROCESSING_STATES } from "./enums.ts";

export const processingStateSchema = z.enum(PROCESSING_STATES);

/** api-specs/05-documents.md 5.1.1. Non-null only when the state is `failed`. */
export const failureReasonSchema = z
  .object({ code: z.enum(FAILURE_REASONS), message: z.string() })
  .meta({ id: "FailureReason" });

/** `isSuggestion` is `confirmed_at IS NULL`. api-specs/06-categories.md 6.7. */
export const documentCategoryRefSchema = z
  .object({ id: z.uuid(), name: z.string(), isSuggestion: z.boolean(), isSystem: z.boolean() })
  .meta({ id: "DocumentCategoryRef" });

/** 5.1. `downloadAllowed` renders a control; 5.9 re-evaluates the predicate regardless. */
export const documentSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    fileType: z.enum(FILE_TYPES),
    sizeBytes: z.number().int().nonnegative(),
    pageCount: z.number().int().nonnegative().nullable(),
    versionNumber: z.number().int().positive(),
    versionCount: z.number().int().positive(),
    processingState: processingStateSchema,
    processingLabel: z.string(),
    failureReason: failureReasonSchema.nullable(),
    uploader: personRefSchema,
    category: documentCategoryRefSchema.nullable(),
    documentType: z.string().nullable(),
    tags: z.array(z.string()).max(3),
    downloadAllowed: z.boolean(),
    createdAt: timestampSchema,
  })
  .meta({ id: "Document" });
export type DocumentView = z.infer<typeof documentSchema>;

/** 5.6. */
export const documentVersionSchema = z
  .object({
    id: z.uuid(),
    versionNumber: z.number().int().positive(),
    filename: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    pageCount: z.number().int().nonnegative().nullable(),
    uploadedBy: personRefSchema,
    createdAt: timestampSchema,
    isCurrent: z.boolean(),
  })
  .meta({ id: "DocumentVersion" });
export type DocumentVersionView = z.infer<typeof documentVersionSchema>;

/** api-specs/07-enrichment.md 7.3. Null means extraction found nothing. */
export const documentMetadataSchema = z
  .object({ author: z.string().nullable(), documentCreatedAt: timestampSchema.nullable() })
  .meta({ id: "DocumentMetadata" });

/** 5.5. */
export const documentDetailSchema = documentSchema
  .extend({
    metadata: documentMetadataSchema.nullable(),
    versions: z.array(documentVersionSchema),
  })
  .meta({ id: "DocumentDetail" });
export type DocumentDetailView = z.infer<typeof documentDetailSchema>;

/** 5.4. Repeated `tags` are conjunctive. */
export const listDocumentsQuery = sortableQuery(
  ["createdAt", "title", "sizeBytes"],
  "createdAt",
  "desc",
).extend({
  categoryId: z.uuid().optional(),
  tags: repeatedQuery(z.string()).optional(),
  state: repeatedQuery(processingStateSchema).optional(),
  unconfirmedOnly: booleanQuery.optional(),
  uploaderId: z.uuid().optional(),
});
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuery>;

/** 5.8. Defaults to the current version. */
export const previewQuery = z.object({ versionId: z.uuid().optional() });

const binaryPart = z.string().meta({ format: "binary" });

/** 5.2. Documentation only: the upload streams and is never parsed by a validator. */
export const uploadDocumentsForm = z.object({ files: z.array(binaryPart).min(1) });

/** 5.7. Documentation only, as 5.2. */
export const uploadVersionForm = z.object({ file: binaryPart });

const uploadedDocumentSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  processingState: processingStateSchema,
  processingLabel: z.string(),
});

const uploadRejectionSchema = z.object({
  code: z.string(),
  message: z.string(),
  existingDocumentId: z.uuid().optional(),
});

/** 5.2. One outcome per submitted file, in submission order. */
export const uploadResultSchema = z
  .discriminatedUnion("status", [
    z.object({
      index: z.number().int().nonnegative(),
      filename: z.string(),
      status: z.literal("accepted"),
      document: uploadedDocumentSchema,
    }),
    z.object({
      index: z.number().int().nonnegative(),
      filename: z.string(),
      status: z.literal("rejected"),
      error: uploadRejectionSchema,
    }),
  ])
  .meta({ id: "UploadResult" });

export const uploadBatchSchema = z
  .object({
    accepted: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    summary: z.string().nullable(),
    results: z.array(uploadResultSchema),
  })
  .meta({ id: "UploadBatch" });
export type UploadBatch = z.infer<typeof uploadBatchSchema>;
