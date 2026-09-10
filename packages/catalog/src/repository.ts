import type { DocumentId, TenantId, VersionId } from "@archiva/shared";
import type { DocumentRecord } from "./service.ts";

export interface CatalogRepository {
  insertDocumentWithVersion(input: {
    tenantId: TenantId;
    contentHash: string;
    blobKey: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<DocumentRecord>;
  findByContentHash(tenantId: TenantId, contentHash: string): Promise<DocumentId | null>;
  /** Allocates under SELECT ... FOR UPDATE on the parent row. AC-21.04. */
  allocateVersionNumber(documentId: DocumentId): Promise<number>;
  findDocument(tenantId: TenantId, documentId: DocumentId): Promise<DocumentRecord | null>;
  findBlobKey(versionId: VersionId): Promise<string | null>;
  updateProcessingState(
    documentId: DocumentId,
    state: DocumentRecord["processingState"],
    reason?: string,
  ): Promise<void>;
}
