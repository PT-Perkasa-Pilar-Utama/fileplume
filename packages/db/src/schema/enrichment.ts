import {
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { documents, documentVersions } from "./catalog.ts";
import { aiField, extractionMethod, tagSource } from "./enums.ts";
import { users } from "./identity.ts";
import { citext } from "./internal/citext.ts";
import { tenants } from "./tenancy.ts";

/** technical-specs/06-data-model.md 6.8. */
export const documentText = pgTable("document_text", {
  versionId: uuid("version_id")
    .primaryKey()
    .references(() => documentVersions.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  extractionMethod: extractionMethod("extraction_method").notNull(),
  language: text("language"),
  charCount: integer("char_count").notNull(),
  extractedAt: timestamp("extracted_at", { withTimezone: true }).notNull(),
});

export const documentPages = pgTable(
  "document_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => documentVersions.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    pageNumber: integer("page_number").notNull(),
    // AC-33.01 needs the page-level snippet, the unit indexed into OpenSearch.
    content: text("content").notNull(),
  },
  (t) => [unique("document_pages_version_number_key").on(t.versionId, t.pageNumber)],
);

export const documentTags = pgTable(
  "document_tags",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    tag: citext("tag").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    source: tagSource("source").notNull().default("ai"),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.tag] })],
);

export const documentMetadata = pgTable("document_metadata", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => documents.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  author: text("author"),
  documentCreatedAt: timestamp("document_created_at", { withTimezone: true }),
});

export const aiFieldOverrides = pgTable("ai_field_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id),
  field: aiField("field").notNull(),
  // Never overwritten — the AI accuracy metric in AC-12.03 is unmeasurable
  // without the original value.
  originalValue: text("original_value"),
  newValue: text("new_value").notNull(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
