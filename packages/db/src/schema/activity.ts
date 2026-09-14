import {
  bigserial,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { analyticsMetric, auditAction, auditOutcome } from "./enums.ts";
import { users } from "./identity.ts";
import { tenants } from "./tenancy.ts";

/** technical-specs/06-data-model.md 6.9. Append-only. */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    actorId: uuid("actor_id").references(() => users.id),
    action: auditAction("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id"),
    outcome: auditOutcome("outcome").notNull().default("allowed"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_events_tenant_idx").on(t.tenantId),
    index("audit_events_tenant_created_idx").on(t.tenantId, t.createdAt),
  ],
);

export const analyticsRollups = pgTable(
  "analytics_rollups",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    metric: analyticsMetric("metric").notNull(),
    bucketDate: date("bucket_date", { mode: "string" }).notNull(),
    // No mode: "number" — 6.1's "no floats anywhere" rule extends to avoiding
    // precision loss on a value that can be an arbitrarily large rolled-up count.
    value: numeric("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.metric, t.bucketDate] })],
);
