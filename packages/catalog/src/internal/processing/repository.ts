import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { DocumentId, FailureReason, TenantId, VersionId } from "@archiva/shared";
import { asDocumentId, asTenantId } from "@archiva/shared";
import { and, asc, eq, gt, isNull, or } from "drizzle-orm";

export interface ProcessingRepository {
  claimVersion(tenantId: TenantId, documentId: DocumentId, versionId: VersionId): Promise<boolean>;
  isCurrentRun(tenantId: TenantId, documentId: DocumentId, versionId: VersionId): Promise<boolean>;
  finishVersion(
    tenantId: TenantId,
    documentId: DocumentId,
    versionId: VersionId,
    outcome: { state: "ready" } | { state: "failed"; reason: FailureReason | null },
  ): Promise<boolean>;
  listRecoverableDocuments(
    limit: number,
    after?: { tenantId: TenantId; documentId: DocumentId },
  ): Promise<{ tenantId: TenantId; documentId: DocumentId }[]>;
}

function currentRun(tenantId: TenantId, documentId: DocumentId, versionId: VersionId) {
  return and(
    eq(schema.documents.tenantId, tenantId),
    eq(schema.documents.id, documentId),
    eq(schema.documents.currentVersionId, versionId),
    eq(schema.documents.processingState, "processing"),
    isNull(schema.documents.deletedAt),
  );
}

export function createDrizzleProcessingRepository(db: Db): ProcessingRepository {
  return {
    async claimVersion(tenantId, documentId, versionId) {
      const rows = await db
        .update(schema.documents)
        .set({
          processingState: "processing",
          failureReason: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.documents.tenantId, tenantId),
            eq(schema.documents.id, documentId),
            eq(schema.documents.currentVersionId, versionId),
            eq(schema.documents.processingState, "queued"),
            isNull(schema.documents.deletedAt),
          ),
        )
        .returning({ id: schema.documents.id });
      return rows.length > 0;
    },
    async isCurrentRun(tenantId, documentId, versionId) {
      const rows = await db
        .select({ id: schema.documents.id })
        .from(schema.documents)
        .where(currentRun(tenantId, documentId, versionId))
        .limit(1);
      return rows.length > 0;
    },
    async finishVersion(tenantId, documentId, versionId, outcome) {
      const rows = await db
        .update(schema.documents)
        .set({
          processingState: outcome.state,
          failureReason: outcome.state === "failed" ? outcome.reason : null,
          updatedAt: new Date(),
        })
        .where(currentRun(tenantId, documentId, versionId))
        .returning({ id: schema.documents.id });
      return rows.length > 0;
    },
    async listRecoverableDocuments(limit, after) {
      const rows = await db
        .select({ tenantId: schema.documents.tenantId, documentId: schema.documents.id })
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.processingState, "queued"),
            isNull(schema.documents.deletedAt),
            after
              ? or(
                  gt(schema.documents.tenantId, after.tenantId),
                  and(
                    eq(schema.documents.tenantId, after.tenantId),
                    gt(schema.documents.id, after.documentId),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(asc(schema.documents.tenantId), asc(schema.documents.id))
        .limit(limit);
      return rows.map((row) => ({
        tenantId: asTenantId(row.tenantId),
        documentId: asDocumentId(row.documentId),
      }));
    },
  };
}
