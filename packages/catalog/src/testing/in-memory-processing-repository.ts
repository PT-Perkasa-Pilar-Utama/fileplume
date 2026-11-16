import type { ProcessingRepository } from "../internal/processing/repository.ts";
import type { StoredDocument } from "./in-memory-types.ts";

export function inMemoryProcessingRepository(documents: StoredDocument[]): ProcessingRepository {
  const matches: ProcessingRepository["isCurrentRun"] = async (tenantId, documentId, versionId) =>
    documents.some(
      (doc) =>
        doc.tenantId === tenantId &&
        doc.id === documentId &&
        doc.currentVersionId === versionId &&
        doc.processingState === "processing",
    );
  return {
    async claimVersion(tenantId, documentId, versionId) {
      const doc = documents.find(
        (row) =>
          row.tenantId === tenantId &&
          row.id === documentId &&
          row.currentVersionId === versionId &&
          row.processingState === "queued",
      );
      if (!doc) return false;
      doc.processingState = "processing";
      doc.failureReason = null;
      return true;
    },
    isCurrentRun: matches,
    async finishVersion(tenantId, documentId, versionId, outcome) {
      const doc = documents.find(
        (row) =>
          row.tenantId === tenantId &&
          row.id === documentId &&
          row.currentVersionId === versionId &&
          row.processingState === "processing",
      );
      if (!doc) return false;
      doc.processingState = outcome.state;
      doc.failureReason = outcome.state === "failed" ? outcome.reason : null;
      return true;
    },
    async listRecoverableDocuments(limit, after) {
      return documents
        .filter(
          (doc) =>
            doc.processingState === "queued" &&
            (!after ||
              doc.tenantId > after.tenantId ||
              (doc.tenantId === after.tenantId && doc.id > after.documentId)),
        )
        .toSorted((left, right) =>
          left.tenantId === right.tenantId
            ? left.id.localeCompare(right.id)
            : left.tenantId.localeCompare(right.tenantId),
        )
        .slice(0, limit)
        .map((doc) => ({ tenantId: doc.tenantId, documentId: doc.id }));
    },
  };
}
