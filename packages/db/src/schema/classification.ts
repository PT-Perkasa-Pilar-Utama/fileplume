import { boolean, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { documents } from "./catalog.ts";
import { users } from "./identity.ts";
import { tenants } from "./tenancy.ts";

/** technical-specs/06-data-model.md 6.7. */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("categories_tenant_name_key").on(t.tenantId, t.name)],
);

export const categoryPermissions = pgTable("category_permissions", {
  categoryId: uuid("category_id")
    .primaryKey()
    .references(() => categories.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  // AC-45.01: a new category always starts Inactive.
  downloadActive: boolean("download_active").notNull().default(false),
  updatedBy: uuid("updated_by")
    .notNull()
    .references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentClassification = pgTable("document_classification", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => documents.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  documentType: text("document_type"),
  aiSuggestedCategoryId: uuid("ai_suggested_category_id").references(() => categories.id),
  aiConfidence: numeric("ai_confidence", { precision: 4, scale: 3 }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  confirmedBy: uuid("confirmed_by").references(() => users.id),
});
