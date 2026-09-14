import { z } from "zod";
import { personRefSchema, repeatedQuery, sortableQuery, timestampSchema } from "./common.ts";
import { AUDIT_ACTIONS, AUDIT_OUTCOMES } from "./enums.ts";

/** api-specs/09-activity.md 9.2. */
export const auditEventsQuery = sortableQuery(["createdAt"], "createdAt", "desc").extend({
  q: z.string().optional(),
  action: repeatedQuery(z.enum(AUDIT_ACTIONS)).optional(),
  outcome: z.enum(AUDIT_OUTCOMES).optional(),
  actorId: z.uuid().optional(),
  subjectId: z.uuid().optional(),
  from: timestampSchema.optional(),
  to: timestampSchema.optional(),
});
export type AuditEventsQuery = z.infer<typeof auditEventsQuery>;

/** `id` is a bigserial rendered as a string, so JavaScript never loses precision. */
export const auditEventSchema = z
  .object({
    id: z.string(),
    action: z.enum(AUDIT_ACTIONS),
    actionLabel: z.string(),
    outcome: z.enum(AUDIT_OUTCOMES),
    actor: personRefSchema.nullable(),
    subject: z
      .object({ type: z.string(), id: z.string(), title: z.string().nullable() })
      .nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: timestampSchema,
  })
  .meta({ id: "AuditEvent" });
export type AuditEventView = z.infer<typeof auditEventSchema>;

const count = z.number().int().nonnegative();
const percent = z.number().nonnegative();

/** 9.3. Zeros, never nulls, for a tenant with no data. */
export const analyticsDashboardSchema = z
  .object({
    volume: z.object({ totalDocuments: count, uploadedLast7Days: count }),
    retrieval: z.object({
      searchesLast7Days: count,
      zeroResultRatePercent: percent,
      documentsOpenedLast7Days: count,
    }),
    aiQuality: z.object({
      categoryOverrideRatePercent: percent,
      fieldOverrideRatePercent: percent,
      sampleSize: count,
    }),
    generatedAt: timestampSchema,
    message: z.string().nullable(),
  })
  .meta({ id: "AnalyticsDashboard" });
export type AnalyticsDashboard = z.infer<typeof analyticsDashboardSchema>;
