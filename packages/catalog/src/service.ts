import type { DocumentId, ErrorCode, Result, TenantId, UserId, VersionId } from "@archiva/shared";
import { err, ok } from "@archiva/shared";
import type * as E from "./errors.ts";
import { buildBatchSummary } from "./internal/batch-summary.ts";
import { mapUploadFailure } from "./internal/map-upload-failure.ts";
import {
  ACCEPTED_MIME,
  isAcceptedType,
  MAX_BATCH,
  MAX_BULK_DOWNLOAD,
} from "./internal/mime-types.ts";
import { type UploadSingleFileDeps, uploadSingleFile } from "./internal/upload-single-file.ts";
import type {
  AuditPort,
  BlobStore,
  Clock,
  DocumentConverter,
  JobQueue,
  QuotaPort,
  QuotaReservationToken,
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
  sessionToken?: string;
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
  session?: SessionPort;
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
  const singleDeps: UploadSingleFileDeps = {
    repository: deps.repository,
    blobStore: deps.blobStore,
    quota: deps.quota,
    session: deps.session,
  };

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
            sessionToken: input.sessionToken,
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
      if (items.length > MAX_BATCH) {
        return err({ kind: "BatchTooLarge" });
      }

      const results: Array<UploadAcceptedResult | UploadRejectedResult> = [];
      const createdDocuments: Array<{
        id: DocumentId;
        filename: string;
        mimeType: string;
        sizeBytes: number;
        blobKey: string;
        reservation: QuotaReservationToken;
      }> = [];
      let accepted = 0;
      let rejected = 0;

      // Sequential, not parallel, so a mixed batch is deterministic. 5.2 step 4.
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        const outcome = await uploadSingleFile(
          tenantId,
          uploaderId,
          item,
          i,
          singleDeps,
          sessionToken,
        );
        if (outcome.status === "session_expired") {
          // Nothing irreversible has been emitted yet: enqueue and audit wait
          // until the whole batch passes, so rollback only removes rows,
          // blobs, and reservations. AC-01.08 leaves no orphan job behind.
          // Best-effort: the primary outcome is SessionExpired, so a failing
          // delete or release must not mask it.
          for (const doc of createdDocuments) {
            await Promise.allSettled([
              deps.repository.deleteDocument(tenantId, doc.id),
              deps.blobStore.delete(doc.blobKey),
              deps.quota.releaseQuota(doc.reservation),
            ]);
          }
          return err({ kind: "SessionExpired" });
        }
        if (outcome.status === "accepted") {
          accepted++;
          createdDocuments.push({
            id: outcome.document.id,
            filename: outcome.filename,
            mimeType: outcome.mimeType,
            sizeBytes: outcome.sizeBytes,
            blobKey: outcome.blobKey,
            reservation: outcome.reservation,
          });
          results.push({
            index: outcome.index,
            filename: outcome.filename,
            status: "accepted",
            document: outcome.document,
          });
        } else {
          rejected++;
          results.push(outcome);
        }
      }

      // Irreversible side effects fire once, in order, after the batch is
      // known good. A later session expiry therefore never leaves an orphan
      // queue job or audit event for a deleted document. AC-01.08.
      for (const doc of createdDocuments) {
        await deps.queue.enqueue(doc.id);
        await deps.audit.record({
          tenantId,
          actorId: uploaderId,
          action: "document.upload",
          subjectType: "document",
          subjectId: doc.id,
          outcome: "allowed",
          metadata: { filename: doc.filename, sizeBytes: doc.sizeBytes, mimeType: doc.mimeType },
        });
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
