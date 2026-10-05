import type { DocumentId, TenantId, UserId, VersionId } from "@archiva/shared";
import type {
  MalwareScanner,
  ScanAuditPort,
  ScanBlobStore,
  ScanCatalogRepository,
  ScanQuotaPort,
} from "../ports.ts";

export type ExecuteScanStageParams = {
  tenantId: TenantId;
  documentId: DocumentId;
  versionId: VersionId;
  uploaderId: UserId;
  blobKey: string;
  sizeBytes: number;
  filename: string;
  scanner: MalwareScanner;
  blobStore: ScanBlobStore;
  catalogRepo: ScanCatalogRepository;
  quota: ScanQuotaPort;
  audit: ScanAuditPort;
  knownInfectionSignature?: string;
  alreadyScannedClean?: boolean;
};

export type ScanStageResult =
  | { status: "clean" }
  | { status: "infected"; signature: string }
  | { status: "stale" };

/**
 * Stage 1 of the document processing pipeline: malware scanning.
 * technical-specs/12-document-processing-pipeline.md 12.1, 12.4.
 * api-specs/05-documents.md 5.3.
 *
 * Outcomes follow AC-46.01 and AC-46.02.
 */
export async function executeScanStage(params: ExecuteScanStageParams): Promise<ScanStageResult> {
  let signature = params.knownInfectionSignature;
  if (signature === undefined && params.alreadyScannedClean) {
    return { status: "clean" };
  }

  if (signature === undefined) {
    const stream = await params.blobStore.get(params.blobKey);
    const result = await params.scanner.scan(stream);

    if (!result.infected) {
      const marked = await params.catalogRepo.markScanComplete(
        params.tenantId,
        params.documentId,
        params.versionId,
      );
      return marked ? { status: "clean" } : { status: "stale" };
    }

    signature = result.signature ?? "unknown";
    const marked = await params.catalogRepo.markMalwareDetected(
      params.tenantId,
      params.documentId,
      params.versionId,
      signature,
    );
    if (!marked) return { status: "stale" };
  }

  await params.audit.record({
    tenantId: params.tenantId,
    actorId: params.uploaderId,
    action: "malware.detected",
    subjectType: "document",
    subjectId: params.documentId,
    outcome: "denied",
    metadata: {
      filename: params.filename,
      signature,
      sizeBytes: params.sizeBytes,
    },
  });
  await params.quota.revertCommittedDocumentQuota({
    documentId: params.documentId,
    tenantId: params.tenantId,
    bytes: params.sizeBytes,
  });
  await params.blobStore.delete(params.blobKey);
  await params.catalogRepo.deleteDocument(params.tenantId, params.documentId);

  return { status: "infected", signature };
}
