import { bigint, index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { configKey, tenantStatus } from "./enums.ts";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subdomain: text("subdomain").notNull().unique(),
  status: tenantStatus("status").notNull().default("active"),
  storageQuotaBytes: bigint("storage_quota_bytes", { mode: "number" })
    .notNull()
    .default(53687091200),
  storageUsedBytes: bigint("storage_used_bytes", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenantConfig = pgTable(
  "tenant_config",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    key: configKey("key").notNull(),
    value: text("value").notNull(),
    updatedBy: uuid("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.key] })],
);

export const quotaReservations = pgTable(
  "quota_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    bytes: bigint("bytes", { mode: "number" }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quota_reservations_expires_idx").on(t.expiresAt)],
);
