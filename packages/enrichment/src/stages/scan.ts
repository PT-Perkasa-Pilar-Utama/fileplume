import type { DocumentId, TenantId, UserId } from "@archiva/shared";
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
  uploaderId: UserId;
  blobKey: string;
  sizeBytes: number;
  filename: string;
  scanner: MalwareScanner;
  blobStore: ScanBlobStore;
  catalogRepo: ScanCatalogRepository;
  quota: ScanQuotaPort;
  audit: ScanAuditPort;
};

export type ScanStageResult = { status: "clean" } | { status: "infected"; signature: string };

/**
 * Stage 1 of the document processing pipeline: malware scanning.
 * technical-specs/12-document-processing-pipeline.md 12.1, 12.4.
 * api-specs/05-documents.md 5.3.
 *
 * Scans uploaded bytes before any parser sees them.
 * On clean (AC-46.01): returns { status: "clean" }.
 * On detection (AC-46.02):
 * - Deletes the blob from storage.
 * - Deletes the document row and its versions from the catalog.
 * - Reverts committed storage quota.
 * - Writes a malware.detected audit event with outcome = "denied".
 * - Returns { status: "infected", signature }.
 * Malware is not a processing state; no failed document row remains.
 */
export async function executeScanStage(params: ExecuteScanStageParams): Promise<ScanStageResult> {
  const stream = await params.blobStore.get(params.blobKey);
  const result = await params.scanner.scan(stream);

  if (!result.infected) {
    return { status: "clean" };
  }

  const signature = result.signature ?? "unknown";

  // AC-46.02: Delete the blob, delete the document, revert the quota commit.
  await Promise.allSettled([
    params.blobStore.delete(params.blobKey),
    params.catalogRepo.deleteDocument(params.tenantId, params.documentId),
    params.quota.revertCommit({
      id: params.documentId,
      tenantId: params.tenantId,
      bytes: params.sizeBytes,
    }),
  ]);

  // AC-46.02: Kejadian tercatat di audit log.
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

  return { status: "infected", signature };
}
