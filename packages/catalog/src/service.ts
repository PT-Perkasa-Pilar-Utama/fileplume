import type { DocumentId, ErrorCode, Result, TenantId, UserId, VersionId } from "@archiva/shared";
import { asDocumentId, err, ok } from "@archiva/shared";
import type * as E from "./errors.ts";
import { buildBatchSummary } from "./internal/batch-summary.ts";
import { type UploadSingleFileDeps, uploadSingleFile } from "./internal/upload-single-file.ts";
import type {
  AuditPort,
  BlobStore,
  Clock,
  DocumentConverter,
  JobQueue,
  QuotaPort,
} from "./ports.ts";
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
  return ACCEPTED_MIME.some((accepted) => accepted === mimeType);
}

export type UploadInput = {
  tenantId: TenantId;
  uploaderId: UserId;
  filename: string;
  stream: ReadableStream;
  sizeBytes: number;
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
  queue?: JobQueue;
  audit?: AuditPort;
};

export interface CatalogService {
  upload(input: UploadInput): Promise<Result<DocumentRecord, UploadFailure>>;
  uploadBatch(
    tenantId: TenantId,
    uploaderId: UserId,
    items: UploadSingleFileItem[],
  ): Promise<Result<UploadBatchOutcome, E.BatchTooLarge>>;
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
  const singleDeps: UploadSingleFileDeps = {
    repository: deps.repository,
    blobStore: deps.blobStore,
    quota: deps.quota,
    ...(deps.queue ? { queue: deps.queue } : {}),
    ...(deps.audit ? { audit: deps.audit } : {}),
  };

  return {
    async upload(input) {
      const batchResult = await this.uploadBatch(input.tenantId, input.uploaderId, [
        { filename: input.filename, stream: input.stream, sizeBytes: input.sizeBytes },
      ]);
      if (!batchResult.ok) return err({ kind: "BatchTooLarge" });
      const first = batchResult.value.results[0];
      if (!first) return err({ kind: "UnsupportedType" });

      if (first.status === "accepted") {
        return ok({
          id: first.document.id,
          title: first.document.title,
          processingState: first.document.processingState,
        });
      }

      switch (first.error.code) {
        case "UNSUPPORTED_TYPE":
          return err({ kind: "UnsupportedType" });
        case "FILE_TOO_LARGE": {
          const limitMb = await deps.quota.getMaxFileSizeMb(input.tenantId);
          return err({ kind: "TooLarge", limitMb });
        }
        case "QUOTA_EXCEEDED":
          return err({ kind: "QuotaExceeded" });
        case "DUPLICATE_CONTENT":
          return err({
            kind: "DuplicateContent",
            ...(first.error.existingDocumentId
              ? { existingDocumentId: asDocumentId(first.error.existingDocumentId) }
              : {}),
          });
        default:
          return err({ kind: "UnsupportedType" });
      }
    },

    async uploadBatch(tenantId, uploaderId, items) {
      if (items.length > MAX_BATCH) {
        return err({ kind: "BatchTooLarge" });
      }

      const results: Array<UploadAcceptedResult | UploadRejectedResult> = [];
      let accepted = 0;
      let rejected = 0;

      // Sequential, not parallel, so a mixed batch is deterministic. 5.2 step 4.
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        const outcome = await uploadSingleFile(tenantId, uploaderId, item, i, singleDeps);
        if (outcome.status === "accepted") {
          accepted++;
        } else {
          rejected++;
        }
        results.push(outcome);
      }

      return ok({
        accepted,
        rejected,
        summary: buildBatchSummary(accepted, rejected),
        results,
      });
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
