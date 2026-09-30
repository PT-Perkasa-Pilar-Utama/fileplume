import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { DocumentId, Result, TenantId, VersionId } from "@archiva/shared";
import { asDocumentId } from "@archiva/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import type * as E from "./errors.ts";
import { findDocumentTenant, queryDocumentDetail } from "./internal/detail-document-query.ts";
import type { RawDocumentDetail, RawDocumentRow } from "./internal/document-views.ts";
import {
  countTenantDocuments,
  type ListDocumentsFilter,
  queryListDocuments,
  type ViewerContext,
} from "./internal/list-document-query.ts";
import {
  type DocumentProcessingRecord,
  queryDocumentForProcessing,
} from "./internal/processing-query.ts";
import {
  allocateVersionNumberTx,
  type InsertDocumentInput,
  insertDocumentWithVersionTx,
} from "./internal/version-mutation.ts";
import type { DocumentRecord } from "./service.ts";

export type {
  DocumentProcessingRecord,
  InsertDocumentInput,
  ListDocumentsFilter,
  RawDocumentDetail,
  RawDocumentRow,
  ViewerContext,
};

export interface CatalogRepository {
  insertDocumentWithVersion(
    tenantId: TenantId,
    input: InsertDocumentInput,
  ): Promise<Result<DocumentRecord, E.DuplicateContent>>;
  findByContentHash(tenantId: TenantId, contentHash: string): Promise<DocumentId | null>;
  /** Allocates under SELECT ... FOR UPDATE on the parent row. AC-21.04. */
  allocateVersionNumber(tenantId: TenantId, documentId: DocumentId): Promise<number>;
  findDocument(tenantId: TenantId, documentId: DocumentId): Promise<DocumentRecord | null>;
  findTenantByDocumentId(documentId: DocumentId): Promise<TenantId | null>;
  findDocumentForProcessing(
    tenantId: TenantId,
    documentId: DocumentId,
  ): Promise<DocumentProcessingRecord | null>;
  claimQueuedDocument(tenantId: TenantId, documentId: DocumentId): Promise<boolean>;
  markScanComplete(
    tenantId: TenantId,
    documentId: DocumentId,
    versionId: VersionId,
  ): Promise<boolean>;
  markMalwareDetected(
    tenantId: TenantId,
    documentId: DocumentId,
    versionId: VersionId,
    signature: string,
  ): Promise<boolean>;
  findBlobKey(tenantId: TenantId, versionId: VersionId): Promise<string | null>;
  deleteDocument(tenantId: TenantId, documentId: DocumentId): Promise<void>;
  listDocuments(
    tenantId: TenantId,
    filter: ListDocumentsFilter,
    viewer: ViewerContext,
    pendingConfirmationDays: number,
    now?: Date,
  ): Promise<{ rows: RawDocumentRow[]; total: number }>;
  findDocumentDetail(
    tenantId: TenantId,
    documentId: DocumentId,
    viewer: ViewerContext,
    pendingConfirmationDays: number,
    now?: Date,
  ): Promise<RawDocumentDetail | { kind: "cross_tenant" } | null>;
  countTenantDocuments(tenantId: TenantId): Promise<number>;
}

export function createDrizzleCatalogRepository(db: Db): CatalogRepository {
  async function findByContentHash(
    tenantId: TenantId,
    contentHash: string,
  ): Promise<DocumentId | null> {
    const [row] = await db
      .select({ documentId: schema.documentVersions.documentId })
      .from(schema.documentVersions)
      .where(
        and(
          eq(schema.documentVersions.tenantId, tenantId),
          eq(schema.documentVersions.contentHash, contentHash),
        ),
      )
      .limit(1);
    return row ? asDocumentId(row.documentId) : null;
  }

  return {
    findByContentHash,

    insertDocumentWithVersion(tenantId, input) {
      return insertDocumentWithVersionTx(db, tenantId, input, findByContentHash);
    },

    allocateVersionNumber(tenantId, documentId) {
      return allocateVersionNumberTx(db, tenantId, documentId);
    },

    async findDocument(tenantId, documentId) {
      const [row] = await db
        .select({
          id: schema.documents.id,
          title: schema.documents.title,
          processingState: schema.documents.processingState,
        })
        .from(schema.documents)
        .where(and(eq(schema.documents.id, documentId), eq(schema.documents.tenantId, tenantId)))
        .limit(1);

      return row
        ? {
            id: asDocumentId(row.id),
            title: row.title,
            processingState: row.processingState,
          }
        : null;
    },

    findTenantByDocumentId(documentId) {
      return findDocumentTenant(db, documentId);
    },

    findDocumentForProcessing(tenantId, documentId) {
      return queryDocumentForProcessing(db, tenantId, documentId);
    },

    async claimQueuedDocument(tenantId, documentId) {
      const updated = await db
        .update(schema.documents)
        .set({ processingState: "processing" })
        .where(
          and(
            eq(schema.documents.id, documentId),
            eq(schema.documents.tenantId, tenantId),
            eq(schema.documents.processingState, "queued"),
            isNull(schema.documents.deletedAt),
          ),
        )
        .returning({ id: schema.documents.id });
      return updated.length > 0;
    },

    async markScanComplete(tenantId, documentId, versionId) {
      const updated = await db
        .update(schema.documentVersions)
        .set({ malwareScannedAt: new Date() })
        .where(
          and(
            eq(schema.documentVersions.id, versionId),
            eq(schema.documentVersions.tenantId, tenantId),
            eq(schema.documentVersions.documentId, documentId),
            isNull(schema.documentVersions.malwareSignature),
            sql`EXISTS (
              SELECT 1 FROM ${schema.documents}
              WHERE ${schema.documents.id} = ${documentId}
                AND ${schema.documents.tenantId} = ${tenantId}
                AND ${schema.documents.currentVersionId} = ${versionId}
                AND ${schema.documents.processingState} = 'processing'
                AND ${schema.documents.deletedAt} IS NULL
            )`,
          ),
        )
        .returning({ id: schema.documentVersions.id });
      return updated.length > 0;
    },

    async markMalwareDetected(tenantId, documentId, versionId, signature) {
      const updated = await db
        .update(schema.documentVersions)
        .set({ malwareSignature: signature })
        .where(
          and(
            eq(schema.documentVersions.id, versionId),
            eq(schema.documentVersions.tenantId, tenantId),
            eq(schema.documentVersions.documentId, documentId),
            isNull(schema.documentVersions.malwareScannedAt),
            isNull(schema.documentVersions.malwareSignature),
            sql`EXISTS (
              SELECT 1 FROM ${schema.documents}
              WHERE ${schema.documents.id} = ${documentId}
                AND ${schema.documents.tenantId} = ${tenantId}
                AND ${schema.documents.currentVersionId} = ${versionId}
                AND ${schema.documents.processingState} = 'processing'
                AND ${schema.documents.deletedAt} IS NULL
            )`,
          ),
        )
        .returning({ id: schema.documentVersions.id });
      return updated.length > 0;
    },

    async findBlobKey(tenantId, versionId) {
      const [row] = await db
        .select({ blobKey: schema.documentVersions.blobKey })
        .from(schema.documentVersions)
        .where(
          and(
            eq(schema.documentVersions.id, versionId),
            eq(schema.documentVersions.tenantId, tenantId),
          ),
        )
        .limit(1);
      return row ? row.blobKey : null;
    },

    async deleteDocument(tenantId, documentId) {
      await db.transaction(async (tx) => {
        await tx
          .update(schema.documents)
          .set({ currentVersionId: null })
          .where(and(eq(schema.documents.id, documentId), eq(schema.documents.tenantId, tenantId)));
        await tx
          .delete(schema.documentVersions)
          .where(
            and(
              eq(schema.documentVersions.documentId, documentId),
              eq(schema.documentVersions.tenantId, tenantId),
            ),
          );
        await tx
          .delete(schema.documents)
          .where(and(eq(schema.documents.id, documentId), eq(schema.documents.tenantId, tenantId)));
      });
    },

    listDocuments(tenantId, filter, viewer, pendingConfirmationDays, now = new Date()) {
      return queryListDocuments(db, tenantId, filter, viewer, pendingConfirmationDays, now);
    },

    findDocumentDetail(tenantId, documentId, viewer, pendingConfirmationDays, now = new Date()) {
      return queryDocumentDetail(db, tenantId, documentId, viewer, pendingConfirmationDays, now);
    },

    countTenantDocuments(tenantId) {
      return countTenantDocuments(db, tenantId);
    },
  };
}
