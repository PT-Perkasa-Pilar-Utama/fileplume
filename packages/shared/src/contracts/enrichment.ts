import { z } from "zod";
import { timestampSchema } from "./common.ts";
import { failureReasonSchema, processingStateSchema } from "./documents.ts";

/** api-specs/07-enrichment.md 7.2. Deliberately narrower than document detail. */
export const processingStatusSchema = z
  .object({
    documentId: z.uuid(),
    state: processingStateSchema,
    label: z.string(),
    failureReason: failureReasonSchema.nullable(),
    searchable: z.boolean(),
    updatedAt: timestampSchema,
  })
  .meta({ id: "ProcessingStatus" });
export type ProcessingStatusView = z.infer<typeof processingStatusSchema>;

/**
 * 7.4. A partial map. An absent key leaves the field alone; `null` is a
 * correction that clears it. Unknown keys and an empty body are refused.
 */
export const correctFieldsBody = z
  .strictObject({
    documentType: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    documentCreatedAt: timestampSchema.nullable().optional(),
    extractedFields: z.record(z.string(), z.string()).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "empty" });
export type CorrectFieldsBody = z.infer<typeof correctFieldsBody>;

/**
 * 7.5. The whole set. The three-tag cap is not a schema rule: more than three
 * answers TOO_MANY_TAGS with the AC-05.05 message, which a schema refusal would replace.
 */
export const replaceTagsBody = z.object({ tags: z.array(z.string().trim().min(1)) });
export type ReplaceTagsBody = z.infer<typeof replaceTagsBody>;

/** 7.6. */
export const reprocessAcceptedSchema = z
  .object({ documentId: z.uuid(), state: z.literal("queued"), label: z.string() })
  .meta({ id: "ReprocessAccepted" });

/** 7.7. */
export const topTagsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const topTagSchema = z
  .object({ tag: z.string(), documentCount: z.number().int().positive() })
  .meta({ id: "TopTag" });
