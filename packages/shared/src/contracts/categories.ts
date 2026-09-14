import { z } from "zod";
import { personRefSchema, sortableQuery, timestampSchema } from "./common.ts";
import { documentDetailSchema } from "./documents.ts";

/** api-specs/06-categories.md 6.1. */
export const categorySchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    isSystem: z.boolean(),
    downloadActive: z.boolean(),
    documentCount: z.number().int().nonnegative(),
    createdBy: personRefSchema.nullable(),
    createdAt: timestampSchema,
    permissionUpdatedAt: timestampSchema.nullable(),
    permissionUpdatedBy: personRefSchema.nullable(),
  })
  .meta({ id: "Category" });
export type CategoryView = z.infer<typeof categorySchema>;

/** 6.2. */
export const listCategoriesQuery = sortableQuery(
  ["name", "createdAt", "documentCount"],
  "name",
  "asc",
).extend({ q: z.string().optional() });

/** 6.3, 6.4. No `downloadActive`: a new category is Inactive whatever the client sends. */
export const categoryNameBody = z.object({ name: z.string().trim().min(1).max(100) });
export type CategoryNameBody = z.infer<typeof categoryNameBody>;

/** 6.5. The desired state, not a flip instruction. */
export const downloadPermissionBody = z.object({ downloadActive: z.boolean() });

/** 6.6. The id is required even to accept the suggestion. */
export const classificationBody = z.object({ categoryId: z.uuid() });

/** 6.6. */
export const classifiedDocumentSchema = documentDetailSchema
  .extend({
    confirmedAt: timestampSchema.nullable(),
    confirmedBy: personRefSchema.nullable(),
  })
  .meta({ id: "ClassifiedDocument" });
export type ClassifiedDocument = z.infer<typeof classifiedDocumentSchema>;

/** 6.8. Oldest first, because this is a work queue. */
export const unconfirmedDocumentsQuery = sortableQuery(
  ["createdAt", "title"],
  "createdAt",
  "asc",
).extend({ reason: z.enum(["uncategorized", "unconfirmed"]).optional() });
