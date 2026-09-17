import type { DocumentId, TenantId, VersionId } from "@archiva/shared";
import type { DocumentRecord } from "./service.ts";

export interface CatalogRepository {
  insertDocumentWithVersion(
    tenantId: TenantId,
    input: {
      contentHash: string;
      blobKey: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
    },
  ): Promise<DocumentRecord>;
  findByContentHash(tenantId: TenantId, contentHash: string): Promise<DocumentId | null>;
  /** Allocates under SELECT ... FOR UPDATE on the parent row. AC-21.04. */
  allocateVersionNumber(tenantId: TenantId, documentId: DocumentId): Promise<number>;
  findDocument(tenantId: TenantId, documentId: DocumentId): Promise<DocumentRecord | null>;
  findBlobKey(tenantId: TenantId, versionId: VersionId): Promise<string | null>;
  updateProcessingState(
    tenantId: TenantId,
    documentId: DocumentId,
    state: DocumentRecord["processingState"],
    reason?: string,
  ): Promise<void>;
}
