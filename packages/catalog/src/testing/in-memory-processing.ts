import type { DocumentId, TenantId, VersionId } from "@archiva/shared";
import type { DocumentProcessingRecord } from "../repository.ts";
import type { StoredDocument, StoredVersion } from "./in-memory-types.ts";

export function inMemoryProcessingMethods(documents: StoredDocument[], versions: StoredVersion[]) {
  return {
    async findDocumentForProcessing(
      tenantId: TenantId,
      documentId: DocumentId,
    ): Promise<DocumentProcessingRecord | null> {
      const doc = documents.find((d) => d.tenantId === tenantId && d.id === documentId);
      if (!doc?.currentVersionId) return null;
      const ver = versions.find((v) => v.id === doc.currentVersionId);
      if (!ver) return null;
      return {
        id: doc.id,
        tenantId: doc.tenantId,
        uploaderId: doc.uploaderId,
        currentVersionId: doc.currentVersionId,
        processingState: doc.processingState,
        malwareScannedAt: ver.malwareScannedAt ?? null,
        malwareSignature: ver.malwareSignature ?? null,
        filename: ver.filename,
        blobKey: ver.blobKey,
        sizeBytes: ver.sizeBytes,
      };
    },

    async claimQueuedDocument(tenantId: TenantId, documentId: DocumentId): Promise<boolean> {
      const doc = documents.find(
        (d) => d.tenantId === tenantId && d.id === documentId && d.processingState === "queued",
      );
      if (!doc) return false;
      doc.processingState = "processing";
      return true;
    },

    async markScanComplete(
      tenantId: TenantId,
      documentId: DocumentId,
      versionId: VersionId,
    ): Promise<boolean> {
      const doc = documents.find(
        (d) =>
          d.tenantId === tenantId &&
          d.id === documentId &&
          d.currentVersionId === versionId &&
          d.processingState === "processing",
      );
      const ver = versions.find(
        (v) => v.tenantId === tenantId && v.documentId === documentId && v.id === versionId,
      );
      if (!doc || !ver || (ver.malwareSignature !== null && ver.malwareSignature !== undefined)) {
        return false;
      }
      ver.malwareScannedAt = new Date();
      return true;
    },

    async markMalwareDetected(
      tenantId: TenantId,
      documentId: DocumentId,
      versionId: VersionId,
      signature: string,
    ): Promise<boolean> {
      const doc = documents.find(
        (d) =>
          d.tenantId === tenantId &&
          d.id === documentId &&
          d.currentVersionId === versionId &&
          d.processingState === "processing",
      );
      const ver = versions.find(
        (v) => v.tenantId === tenantId && v.documentId === documentId && v.id === versionId,
      );
      if (
        !doc ||
        !ver ||
        (ver.malwareScannedAt !== null && ver.malwareScannedAt !== undefined) ||
        (ver.malwareSignature !== null && ver.malwareSignature !== undefined)
      ) {
        return false;
      }
      ver.malwareSignature = signature;
      return true;
    },
  };
}
