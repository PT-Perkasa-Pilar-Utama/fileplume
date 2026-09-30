import type { CatalogRepository } from "@archiva/catalog";
import type {
  MalwareScanner,
  ScanAuditPort,
  ScanBlobStore,
  ScanQuotaPort,
} from "@archiva/enrichment";
import { executeScanStage } from "@archiva/enrichment";
import type { DocumentId } from "@archiva/shared";

export const QUEUE_NAME = "document.process";

export type ProcessDocumentJob = { documentId: DocumentId };

export type ProcessDocumentOutcome = "clean" | "infected" | "noop";

export type ProcessDocumentDeps = {
  catalogRepo: CatalogRepository;
  blobStore: ScanBlobStore;
  quota: ScanQuotaPort;
  audit: ScanAuditPort;
  scanner: MalwareScanner;
};

export type ProcessDocumentHandler = (job: ProcessDocumentJob) => Promise<ProcessDocumentOutcome>;

/**
 * Factory for the document processing handler.
 * technical-specs/12-document-processing-pipeline.md 12.1 to 12.3.
 * Cards BE-S2-07, BE-S3-01.
 */
export function createProcessDocumentHandler(deps: ProcessDocumentDeps): ProcessDocumentHandler {
  return async function processDocument(job: ProcessDocumentJob): Promise<ProcessDocumentOutcome> {
    const tenantId = await deps.catalogRepo.findTenantByDocumentId(job.documentId);
    if (!tenantId) {
      return "noop";
    }

    const doc = await deps.catalogRepo.findDocumentForProcessing(tenantId, job.documentId);
    if (!doc) {
      return "noop";
    }

    // 12.1 Idempotency: a READY document is a no-op.
    if (doc.processingState === "ready") {
      return "noop";
    }

    // State transition guard: queued -> processing
    if (doc.processingState === "queued") {
      await deps.catalogRepo.updateProcessingState(tenantId, job.documentId, "processing");
    }

    // Stage 1: Malware scan (BE-S2-07, AC-46.01, AC-46.02)
    const scanResult = await executeScanStage({
      tenantId,
      documentId: job.documentId,
      uploaderId: doc.uploaderId,
      blobKey: doc.blobKey,
      sizeBytes: doc.sizeBytes,
      filename: doc.filename,
      scanner: deps.scanner,
      blobStore: deps.blobStore,
      catalogRepo: deps.catalogRepo,
      quota: deps.quota,
      audit: deps.audit,
    });

    if (scanResult.status === "infected") {
      return "infected";
    }

    // AC-46.01: Clean document passes scan stage.
    // In Sprint 2, scan is the only pipeline stage. When scan clears, mark READY.
    // In Sprint 3 (BE-S3-01), extract, classify, and index stages will execute before READY.
    await deps.catalogRepo.updateProcessingState(tenantId, job.documentId, "ready");
    return "clean";
  };
}

/**
 * The worker entry point stub for BullMQ.
 * technical-specs/12-document-processing-pipeline.md 12.3. Card BE-S3-01.
 */
export async function processDocument(_job: ProcessDocumentJob): Promise<void> {
  throw new Error("SCAFFOLD: implement in BE-S3-01");
}
