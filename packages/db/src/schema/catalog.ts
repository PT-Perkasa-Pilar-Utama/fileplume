import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  bigint,
  char,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { failureReason, processingState } from "./enums.ts";
import { users } from "./identity.ts";
import { tenants } from "./tenancy.ts";

/**
 * technical-specs/06-data-model.md 6.5. documents and document_versions
 * reference each other (current_version_id / document_id), so document_versions
 * is declared after documents and referenced back via a lazy callback.
 */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    currentVersionId: uuid("current_version_id").references((): AnyPgColumn => documentVersions.id),
    processingState: processingState("processing_state").notNull().default("queued"),
    failureReason: failureReason("failure_reason"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("documents_tenant_idx").on(t.tenantId),
    index("documents_tenant_state_idx").on(t.tenantId, t.processingState),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    versionNumber: integer("version_number").notNull(),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    pageCount: integer("page_count"),
    blobKey: text("blob_key").notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("document_versions_tenant_idx").on(t.tenantId),
    index("document_versions_document_idx").on(t.documentId),
    index("document_versions_hash_idx").on(t.contentHash),
    // 12-document-processing-pipeline.md 133: the sole source for this
    // constraint. Unconditional, no partial predicate — 06-data-model.md 6.5's
    // "where deleted_at IS NULL" clause references a column document_versions
    // does not have, and restates a rule 12-doc already owns.
    unique("document_versions_tenant_hash_key").on(t.tenantId, t.contentHash),
    unique("document_versions_document_number_key").on(t.documentId, t.versionNumber),
  ],
);
