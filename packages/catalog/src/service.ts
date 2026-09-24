import type { DocumentId, ErrorCode, Result, TenantId, UserId, VersionId } from "@archiva/shared";
import { err, ok } from "@archiva/shared";
import type * as E from "./errors.ts";
import { MAX_BATCH, MAX_BULK_DOWNLOAD } from "./internal/limits.ts";
import { mapUploadFailure } from "./internal/map-upload-failure.ts";
import { ACCEPTED_MIME, isAcceptedType } from "./internal/mime-types.ts";
import { uploadBatch } from "./internal/upload-batch.ts";
import type {
  AuditPort,
  BlobStore,
  Clock,
  DocumentConverter,
  JobQueue,
  QuotaPort,
  SessionPort,
} from "./ports.ts";
import type { CatalogRepository } from "./repository.ts";

export { ACCEPTED_MIME, isAcceptedType, MAX_BATCH, MAX_BULK_DOWNLOAD };

export type UploadInput = {
  tenantId: TenantId;
  uploaderId: UserId;
  filename: string;
  stream: ReadableStream;
  sizeBytes: number;
  sessionToken?: string;
};

export type UploadSingleFileItem = {
  filename: string;
  stream: ReadableStream;
  sizeBytes: number;
};

export type DocumentRecord = {
  id: DocumentId;
  title: string;
  processingState: "queued" | "processing" | "ready" | "failed";
};

export type UploadFailure =
  | E.UnsupportedType
  | E.TooLarge
  | E.QuotaExceeded
  | E.DuplicateContent
  | E.BatchTooLarge;

export type UploadAcceptedResult = {
  index: number;
  filename: string;
  status: "accepted";
  document: {
    id: DocumentId;
    title: string;
    processingState: "queued";
    processingLabel: "Antre";
  };
};

export type UploadRejectedResult = {
  index: number;
  filename: string;
  status: "rejected";
  error: {
    code: ErrorCode;
    message: string;
    existingDocumentId?: string;
  };
};

export type UploadBatchOutcome = {
  accepted: number;
  rejected: number;
  summary: string | null;
  results: Array<UploadAcceptedResult | UploadRejectedResult>;
};

export type CatalogServiceDeps = {
  repository: CatalogRepository;
  blobStore: BlobStore;
  converter?: DocumentConverter;
  // Unused by the upload path; version writes in BE-S2-04 stamp it.
  clock: Clock;
  quota: QuotaPort;
  queue: JobQueue;
  audit: AuditPort;
  session: SessionPort;
};

export interface CatalogService {
  upload(input: UploadInput): Promise<Result<DocumentRecord, UploadFailure | E.SessionExpired>>;
  uploadBatch(
    tenantId: TenantId,
    uploaderId: UserId,
    items: UploadSingleFileItem[],
    sessionToken?: string,
  ): Promise<Result<UploadBatchOutcome, E.BatchTooLarge | E.SessionExpired>>;
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

export function createCatalogService(deps: CatalogServiceDeps): CatalogService {
  return {
    async upload(input) {
      const batchResult = await this.uploadBatch(
        input.tenantId,
        input.uploaderId,
        [
          {
            filename: input.filename,
            stream: input.stream,
            sizeBytes: input.sizeBytes,
          },
        ],
        input.sessionToken,
      );
      if (!batchResult.ok) {
        if (batchResult.error.kind === "SessionExpired") {
          return err({ kind: "SessionExpired" });
        }
        return err({ kind: "BatchTooLarge" });
      }
      const first = batchResult.value.results[0];
      if (!first) throw new Error("uploadBatch returned no result for a single item");

      if (first.status === "accepted") {
        return ok({
          id: first.document.id,
          title: first.document.title,
          processingState: first.document.processingState,
        });
      }

      return await mapUploadFailure(first, input.tenantId, deps.quota);
    },

    async uploadBatch(tenantId, uploaderId, items, sessionToken) {
      return uploadBatch(tenantId, uploaderId, items, deps, sessionToken);
    },

    addVersion() {
      throw new Error("SCAFFOLD: BE-S2-04");
    },
    getDocument() {
      throw new Error("SCAFFOLD: BE-S2-06");
    },
    openBlob() {
      throw new Error("SCAFFOLD: BE-S4-06");
    },
    setProcessingState() {
      throw new Error("SCAFFOLD: BE-S3-01");
    },
  };
}
