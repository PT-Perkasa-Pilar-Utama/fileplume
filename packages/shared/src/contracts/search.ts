import { z } from "zod";
import { paginationQuery } from "../envelope.ts";
import { personRefSchema, repeatedQuery, timestampSchema } from "./common.ts";
import { FILE_TYPES } from "./enums.ts";

/**
 * api-specs/08-search.md 8.2. Trimmed before any length check. The two-character
 * floor is the service's, so a short query answers QUERY_TOO_SHORT with the
 * AC-07.03 message rather than VALIDATION_ERROR.
 */
export const titleSearchQuery = paginationQuery
  .omit({ order: true })
  .extend({ q: z.string().trim().max(200) });
export type TitleSearchQuery = z.infer<typeof titleSearchQuery>;

/** 8.3. */
export const contentSearchQuery = titleSearchQuery.extend({
  categoryId: z.uuid().optional(),
  tags: repeatedQuery(z.string()).optional(),
});
export type ContentSearchQuery = z.infer<typeof contentSearchQuery>;

/** 8.2. `fragment` carries `<em>` around the match and nothing else. */
export const titleHitSchema = z
  .object({
    documentId: z.uuid(),
    title: z.string(),
    fileType: z.enum(FILE_TYPES),
    fragment: z.string(),
    uploader: personRefSchema,
    category: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    createdAt: timestampSchema,
    score: z.number(),
  })
  .meta({ id: "TitleHit" });

/** 8.3. `pageNumber` is the coordinate the viewer jumps to. */
export const contentHitSchema = z
  .object({
    documentId: z.uuid(),
    title: z.string(),
    fileType: z.enum(FILE_TYPES),
    pageNumber: z.number().int().positive(),
    fragment: z.string(),
    matchCount: z.number().int().positive(),
    uploader: personRefSchema,
    score: z.number(),
  })
  .meta({ id: "ContentHit" });

/** 8.4. The cap is 5 and cannot be raised. */
export const relatedQuery = z.object({
  limit: z.coerce.number().int().min(1).max(5).default(5),
});

export const relatedDocumentSchema = z
  .object({
    documentId: z.uuid(),
    title: z.string(),
    fileType: z.enum(FILE_TYPES),
    uploader: personRefSchema,
    sharedCategory: z.boolean(),
    sharedTags: z.array(z.string()),
    score: z.number(),
  })
  .meta({ id: "RelatedDocument" });
