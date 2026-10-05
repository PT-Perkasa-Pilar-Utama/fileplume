import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { DocumentId, TenantId, UserId, VersionId } from "@archiva/shared";
import { asDocumentId, asTenantId, asUserId, asVersionId } from "@archiva/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { DocumentRecord } from "../service.ts";

export type DocumentProcessingRecord = {
  id: DocumentId;
  tenantId: TenantId;
  uploaderId: UserId;
  currentVersionId: VersionId;
  processingState: DocumentRecord["processingState"];
  malwareScannedAt: Date | null;
  malwareSignature: string | null;
  filename: string;
  blobKey: string;
  sizeBytes: number;
};

export async function queryDocumentForProcessing(
  db: Db,
  tenantId: TenantId,
  documentId: DocumentId,
): Promise<DocumentProcessingRecord | null> {
  const [row] = await db
    .select({
      id: schema.documents.id,
      tenantId: schema.documents.tenantId,
      uploaderId: schema.documents.uploaderId,
      currentVersionId: schema.documents.currentVersionId,
      processingState: schema.documents.processingState,
      malwareScannedAt: schema.documentVersions.malwareScannedAt,
      malwareSignature: schema.documentVersions.malwareSignature,
      filename: schema.documentVersions.filename,
      blobKey: schema.documentVersions.blobKey,
      sizeBytes: schema.documentVersions.sizeBytes,
    })
    .from(schema.documents)
    .innerJoin(
      schema.documentVersions,
      eq(schema.documents.currentVersionId, schema.documentVersions.id),
    )
    .where(
      and(
        eq(schema.documents.tenantId, tenantId),
        eq(schema.documents.id, documentId),
        isNull(schema.documents.deletedAt),
      ),
    )
    .limit(1);

  if (!row?.currentVersionId) {
    return null;
  }

  return {
    id: asDocumentId(row.id),
    tenantId: asTenantId(row.tenantId),
    uploaderId: asUserId(row.uploaderId),
    currentVersionId: asVersionId(row.currentVersionId),
    processingState: row.processingState,
    malwareScannedAt: row.malwareScannedAt,
    malwareSignature: row.malwareSignature,
    filename: row.filename,
    blobKey: row.blobKey,
    sizeBytes: Number(row.sizeBytes),
  };
}
