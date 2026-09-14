import { sql } from "drizzle-orm";
import { check, index, inet, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { userRole } from "./enums.ts";
import { citext } from "./internal/citext.ts";
import { tenants } from "./tenancy.ts";

/** technical-specs/06-data-model.md 6.4. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    email: citext("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: userRole("role").notNull().default("member"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("users_tenant_idx").on(t.tenantId),
    // grooming D10: super_admin sits outside every tenant. Enforced here, not
    // by convention.
    check(
      "users_role_tenant_check",
      sql`(${t.role} = 'super_admin' AND ${t.tenantId} IS NULL) OR (${t.role} <> 'super_admin' AND ${t.tenantId} IS NOT NULL)`,
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);
