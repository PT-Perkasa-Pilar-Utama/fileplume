import type {
  DocumentId,
  DocumentVersionView,
  Result,
  TenantId,
  UserId,
  VersionId,
} from "@archiva/shared";
import type * as E from "../errors.ts";

export type DocumentRecord = {
  id: DocumentId;
  title: string;
  processingState: "queued" | "processing" | "ready" | "failed";
  failureReason?: string | null;
  currentVersionId?: VersionId | null;
  currentVersionHash?: string | null;
  currentMimeType?: string | null;
  uploaderId?: string;
  uploaderName?: string;
  createdAt?: string;
};

export type InsertDocumentInput = {
  documentId?: DocumentId;
  versionId?: VersionId;
  uploaderId: UserId;
  contentHash: string;
  blobKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export type InsertVersionInput = {
  documentId: DocumentId;
  versionId?: VersionId;
  uploaderId: UserId;
  contentHash: string;
  blobKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export interface CatalogRepository {
  insertDocumentWithVersion(
    tenantId: TenantId,
    input: InsertDocumentInput,
  ): Promise<Result<DocumentRecord, E.DuplicateContent>>;
  findByContentHash(tenantId: TenantId, contentHash: string): Promise<DocumentId | null>;
  findDocument(tenantId: TenantId, documentId: DocumentId): Promise<DocumentRecord | null>;
  findBlobKey(tenantId: TenantId, versionId: VersionId): Promise<string | null>;
  deleteDocument(tenantId: TenantId, documentId: DocumentId): Promise<void>;
  updateProcessingState(
    tenantId: TenantId,
    documentId: DocumentId,
    state: DocumentRecord["processingState"],
    reason?: string,
  ): Promise<void>;
  insertVersionAndUpdateDocument(
    tenantId: TenantId,
    input: InsertVersionInput,
  ): Promise<
    Result<{ versionId: VersionId; versionNumber: number }, E.IdenticalContent | E.DuplicateContent>
  >;
  listVersions(tenantId: TenantId, documentId: DocumentId): Promise<DocumentVersionView[] | null>;
}
