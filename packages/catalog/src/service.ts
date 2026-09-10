import type { DocumentId, Result, TenantId, UserId, VersionId } from "@archiva/shared";
import type * as E from "./errors.ts";
import type { BlobStore, Clock, DocumentConverter } from "./ports.ts";
import type { CatalogRepository } from "./repository.ts";

export const MAX_BATCH = 20;
export const MAX_BULK_DOWNLOAD = 50;

export const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
] as const;

/** Decided by magic-byte sniffing upstream, never by the extension. */
export function isAcceptedType(mimeType: string): boolean {
  return (ACCEPTED_MIME as readonly string[]).includes(mimeType);
}

export type UploadInput = {
  tenantId: TenantId;
  uploaderId: UserId;
  filename: string;
  mimeType: string;
  stream: ReadableStream;
  sizeBytes: number;
};

export type DocumentRecord = {
  id: DocumentId;
  title: string;
  processingState: "queued" | "processing" | "ready" | "failed";
};

export type UploadFailure = E.UnsupportedType | E.TooLarge | E.QuotaExceeded | E.DuplicateContent;

export interface CatalogService {
  /**
   * Hides eight validations, a hash computation, the quota protocol, a blob
   * write, two inserts and a job enqueue behind one call that returns a
   * document or a typed reason.
   */
  upload(input: UploadInput): Promise<Result<DocumentRecord, UploadFailure>>;
  addVersion(
    documentId: DocumentId,
    input: UploadInput,
  ): Promise<
    Result<
      { versionId: VersionId; versionNumber: number },
      E.IdenticalContent | E.NotFound | UploadFailure
    >
  >;
  getDocument(
    tenantId: TenantId,
    documentId: DocumentId,
  ): Promise<Result<DocumentRecord, E.NotFound>>;
  openBlob(versionId: VersionId): Promise<ReadableStream>;
  setProcessingState(
    documentId: DocumentId,
    state: DocumentRecord["processingState"],
    reason?: string,
  ): Promise<void>;
}

export function createCatalogService(_deps: {
  repository: CatalogRepository;
  blobStore: BlobStore;
  converter: DocumentConverter;
  clock: Clock;
}): CatalogService {
  throw new Error("SCAFFOLD: implement in BE-S2-01, BE-S2-03, BE-S2-04, BE-S2-06");
}
