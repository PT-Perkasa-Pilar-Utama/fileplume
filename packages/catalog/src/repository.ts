import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { DocumentId, Result, TenantId, UserId, VersionId } from "@archiva/shared";
import { asDocumentId, asVersionId, err, ok } from "@archiva/shared";
import { and, eq, sql } from "drizzle-orm";
import type * as E from "./errors.ts";
import { queryDocumentDetail } from "./internal/detail-document-query.ts";
import type { RawDocumentDetail, RawDocumentRow } from "./internal/document-views.ts";
import {
  countTenantDocuments,
  type ListDocumentsFilter,
  queryListDocuments,
  type ViewerContext,
} from "./internal/list-document-query.ts";
import { isUniqueViolationOn } from "./internal/unique-violation.ts";
import type { DocumentRecord } from "./service.ts";

export type { ListDocumentsFilter, RawDocumentDetail, RawDocumentRow, ViewerContext };

export type InsertDocumentInput = {
  documentId?: DocumentId;
  versionId?: VersionId;
  uploaderId: UserId;
  contentHash: string;
  blobKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
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
  findBlobKey(tenantId: TenantId, versionId: VersionId): Promise<string | null>;
  deleteDocument(tenantId: TenantId, documentId: DocumentId): Promise<void>;
  updateProcessingState(
    tenantId: TenantId,
    documentId: DocumentId,
    state: DocumentRecord["processingState"],
    reason?: string,
  ): Promise<void>;
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

    async insertDocumentWithVersion(tenantId, input) {
      try {
        return await db.transaction(async (tx) => {
          const docId = input.documentId ?? asDocumentId(crypto.randomUUID());
          const verId = input.versionId ?? asVersionId(crypto.randomUUID());

          const [doc] = await tx
            .insert(schema.documents)
            .values({
              id: docId,
              tenantId,
              uploaderId: input.uploaderId,
              title: input.filename,
              processingState: "queued",
            })
            .returning({
              id: schema.documents.id,
              title: schema.documents.title,
              processingState: schema.documents.processingState,
            });

          if (!doc) throw new Error("insertDocumentWithVersion: document insert returned no row");

          const [ver] = await tx
            .insert(schema.documentVersions)
            .values({
              id: verId,
              tenantId,
              documentId: doc.id,
              versionNumber: 1,
              contentHash: input.contentHash,
              filename: input.filename,
              mimeType: input.mimeType,
              sizeBytes: input.sizeBytes,
              blobKey: input.blobKey,
              uploadedBy: input.uploaderId,
            })
            .returning({ id: schema.documentVersions.id });

          if (!ver) throw new Error("insertDocumentWithVersion: version insert returned no row");

          await tx
            .update(schema.documents)
            .set({ currentVersionId: ver.id })
            .where(and(eq(schema.documents.id, doc.id), eq(schema.documents.tenantId, tenantId)));

          return ok({
            id: asDocumentId(doc.id),
            title: doc.title,
            processingState: doc.processingState,
          });
        });
      } catch (caughtErr) {
        if (isUniqueViolationOn(caughtErr, "document_versions_tenant_hash_key")) {
          // The loser of the insert race reads back the winner. AC-03.04.
          const existingId = await findByContentHash(tenantId, input.contentHash);
          return existingId
            ? err({ kind: "DuplicateContent", existingDocumentId: existingId })
            : err({ kind: "DuplicateContent" });
        }
        throw caughtErr;
      }
    },

    async allocateVersionNumber(tenantId, documentId) {
      return await db.transaction(async (tx) => {
        await tx
          .select({ id: schema.documents.id })
          .from(schema.documents)
          .where(and(eq(schema.documents.id, documentId), eq(schema.documents.tenantId, tenantId)))
          .for("update");

        const [row] = await tx
          .select({
            maxVer: sql<number>`coalesce(max(${schema.documentVersions.versionNumber}), 0)`,
          })
          .from(schema.documentVersions)
          .where(
            and(
              eq(schema.documentVersions.documentId, documentId),
              eq(schema.documentVersions.tenantId, tenantId),
            ),
          );
        return (row?.maxVer ?? 0) + 1;
      });
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

    async updateProcessingState(tenantId, documentId, state) {
      await db
        .update(schema.documents)
        .set({ processingState: state })
        .where(and(eq(schema.documents.id, documentId), eq(schema.documents.tenantId, tenantId)));
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
