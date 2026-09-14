import { z } from "zod";
import { timestampSchema } from "./common.ts";

/** api-specs/05-documents.md 5.9. */
export const downloadDocumentBody = z.object({ versionId: z.uuid().optional() });

/** api-specs/01-conventions.md 1.9. Header names arrive lowercased. */
export const idempotencyHeaders = z.object({ "idempotency-key": z.uuid().optional() });

/**
 * 5.10. The 50 cap is not a schema rule: more than 50 answers TOO_MANY_SELECTED
 * with the AC-11.03 message, which a schema refusal would replace.
 */
export const bulkDownloadBody = z.object({
  documentIds: z
    .array(z.uuid())
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, { message: "duplicate" }),
});
export type BulkDownloadBody = z.infer<typeof bulkDownloadBody>;

const omittedDocumentSchema = z.object({
  documentId: z.uuid(),
  title: z.string().nullable(),
  reason: z.enum(["DOWNLOAD_FORBIDDEN", "NOT_FOUND"]),
});

/** 5.10. `downloadUrl` is null when every selected document was omitted. */
export const bulkDownloadTicketSchema = z
  .object({
    ticketId: z.uuid(),
    downloadUrl: z.string().nullable(),
    expiresAt: timestampSchema,
    includedCount: z.number().int().nonnegative(),
    omittedCount: z.number().int().nonnegative(),
    omitted: z.array(omittedDocumentSchema),
    message: z.string().nullable(),
  })
  .meta({ id: "BulkDownloadTicket" });
export type BulkDownloadTicket = z.infer<typeof bulkDownloadTicketSchema>;

/** 5.11. */
export const ticketParams = z.object({ ticketId: z.uuid() });
