import type {
  DocumentId,
  FailureReason,
  ProcessingState,
  TenantId,
  UserId,
  VersionId,
} from "@archiva/shared";

export type StoredDocument = {
  id: DocumentId;
  tenantId: TenantId;
  title: string;
  processingState: ProcessingState;
  failureReason: FailureReason | null;
  currentVersionId: VersionId | null;
  uploaderId: UserId;
  uploaderName: string;
  createdAt: Date;
  categoryId: string | null;
  categoryName: string | null;
  categoryIsSystem: boolean | null;
  categoryConfirmedAt: Date | null;
  categoryDownloadActive: boolean | null;
  documentType: string | null;
  tags: string[];
  author: string | null;
  documentCreatedAt: Date | null;
};

export type StoredVersion = {
  id: VersionId;
  tenantId: TenantId;
  documentId: DocumentId;
  versionNumber: number;
  contentHash: string;
  blobKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number | null;
  uploadedById: UserId;
  uploadedByName: string;
  createdAt: Date;
};
