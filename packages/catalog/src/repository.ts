import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { DocumentId } from "@archiva/shared";
import { asDocumentId, asVersionId, ok } from "@archiva/shared";
import { and, eq } from "drizzle-orm";
import type { CatalogRepository } from "./internal/repository-types.ts";
import { toDuplicateContentError } from "./internal/unique-violation.ts";
import * as versionRepo from "./internal/version-repository.ts";

export type * from "./internal/repository-types.ts";

const UNKNOWN_USER_NAME = "Unknown User";

const docMatch = (docId: string, tId: string) =>
  and(eq(schema.documents.id, docId), eq(schema.documents.tenantId, tId));

export function createDrizzleCatalogRepository(db: Db): CatalogRepository {
  async function findByContentHash(tenantId: string, hash: string): Promise<DocumentId | null> {
    const [row] = await db
      .select({ documentId: schema.documentVersions.documentId })
      .from(schema.documentVersions)
      .where(
        and(
          eq(schema.documentVersions.tenantId, tenantId),
          eq(schema.documentVersions.contentHash, hash),
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
            .where(docMatch(doc.id, tenantId));

          return ok({
            id: asDocumentId(doc.id),
            title: doc.title,
            processingState: doc.processingState,
          });
        });
      } catch (caughtErr) {
        return await toDuplicateContentError(
          caughtErr,
          tenantId,
          input.contentHash,
          findByContentHash,
        );
      }
    },

    async findDocument(tenantId, documentId) {
      const [row] = await db
        .select({
          id: schema.documents.id,
          title: schema.documents.title,
          processingState: schema.documents.processingState,
          failureReason: schema.documents.failureReason,
          createdAt: schema.documents.createdAt,
          currentVersionId: schema.documents.currentVersionId,
          uploaderId: schema.documents.uploaderId,
          uploaderName: schema.users.name,
          currentVersionHash: schema.documentVersions.contentHash,
          currentMimeType: schema.documentVersions.mimeType,
        })
        .from(schema.documents)
        .leftJoin(schema.users, eq(schema.documents.uploaderId, schema.users.id))
        .leftJoin(
          schema.documentVersions,
          eq(schema.documents.currentVersionId, schema.documentVersions.id),
        )
        .where(docMatch(documentId, tenantId))
        .limit(1);

      if (!row) return null;
      return {
        id: asDocumentId(row.id),
        title: row.title,
        processingState: row.processingState,
        failureReason: row.failureReason,
        currentVersionId: row.currentVersionId ? asVersionId(row.currentVersionId) : null,
        currentVersionHash: row.currentVersionHash ?? null,
        currentMimeType: row.currentMimeType ?? null,
        uploaderId: row.uploaderId,
        uploaderName: row.uploaderName ?? UNKNOWN_USER_NAME,
        createdAt: row.createdAt.toISOString(),
      };
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
        .where(docMatch(documentId, tenantId));
    },

    async insertVersionAndUpdateDocument(tenantId, input) {
      return versionRepo.insertVersionAndUpdateDocument(db, tenantId, input, findByContentHash);
    },

    async listVersions(tenantId, documentId) {
      return versionRepo.listVersions(db, tenantId, documentId);
    },
  };
}
