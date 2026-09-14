import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { bigint, index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { configKey, tenantStatus } from "./enums.ts";
// Circular file import, safe: users.tenantId references tenants.id and this
// file references users.id, both through a lazy callback drizzle only
// resolves once both modules have finished evaluating.
import { users } from "./identity.ts";
import { citext } from "./internal/citext.ts";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subdomain: citext("subdomain").notNull().unique(),
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
    updatedBy: uuid("updated_by")
      .notNull()
      .references((): AnyPgColumn => users.id),
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
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '15 minutes'`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("quota_reservations_tenant_idx").on(t.tenantId),
    index("quota_reservations_expires_idx").on(t.expiresAt),
  ],
);
