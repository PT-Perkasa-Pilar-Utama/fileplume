import type { DocumentId, TenantId, UserId } from "@archiva/shared";
import { err, ok } from "@archiva/shared";
import type * as E from "../errors.ts";
import type {
  AuditPort,
  BlobStore,
  JobQueue,
  QuotaPort,
  QuotaReservationToken,
  SessionPort,
} from "../ports.ts";
import type { CatalogRepository } from "../repository.ts";
import type {
  UploadAcceptedResult,
  UploadBatchOutcome,
  UploadRejectedResult,
  UploadSingleFileItem,
} from "../service.ts";
import { buildBatchSummary } from "./batch-summary.ts";
import { MAX_BATCH } from "./limits.ts";
import { reportSettled } from "./report-settled.ts";
import { type UploadSingleFileDeps, uploadSingleFile } from "./upload-single-file.ts";

export type UploadBatchDeps = {
  repository: CatalogRepository;
  blobStore: BlobStore;
  quota: QuotaPort;
  queue: JobQueue;
  audit: AuditPort;
  session: SessionPort;
};

type CreatedDocument = {
  id: DocumentId;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  blobKey: string;
  reservation: QuotaReservationToken;
};

async function rollbackBatch(
  tenantId: TenantId,
  docs: CreatedDocument[],
  deps: UploadBatchDeps,
): Promise<void> {
  for (const doc of docs) {
    reportSettled(
      await Promise.allSettled([
        deps.repository.deleteDocument(tenantId, doc.id),
        deps.blobStore.delete(doc.blobKey),
        deps.quota.releaseQuota(doc.reservation),
      ]),
      "batch rollback failed after session expiry",
    );
  }
}

async function emitPostBatch(
  tenantId: TenantId,
  uploaderId: UserId,
  docs: CreatedDocument[],
  deps: UploadBatchDeps,
): Promise<void> {
  for (const doc of docs) {
    // Commit what the blob store actually wrote, not the declared size,
    // so route-level streaming never drifts quota.
    await deps.quota.commitQuota({ ...doc.reservation, bytes: doc.sizeBytes });
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
}

/**
 * Sequential, not parallel, so a mixed batch is deterministic. 5.2 step 4.
 * Reservations stay open for the whole batch; commit, enqueue and audit fire
 * once, in order, after the batch is known good. A later session expiry
 * therefore never leaves an orphan queue job or audit event for a deleted
 * document, and rollback always has a live reservation to release. AC-01.08.
 */
export async function uploadBatch(
  tenantId: TenantId,
  uploaderId: UserId,
  items: UploadSingleFileItem[],
  deps: UploadBatchDeps,
  sessionToken?: string,
): Promise<
  { ok: true; value: UploadBatchOutcome } | { ok: false; error: E.BatchTooLarge | E.SessionExpired }
> {
  if (items.length > MAX_BATCH) {
    return err({ kind: "BatchTooLarge" });
  }

  const singleDeps: UploadSingleFileDeps = {
    repository: deps.repository,
    blobStore: deps.blobStore,
    quota: deps.quota,
    session: deps.session,
  };

  const results: Array<UploadAcceptedResult | UploadRejectedResult> = [];
  const createdDocuments: CreatedDocument[] = [];
  let accepted = 0;
  let rejected = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const outcome = await uploadSingleFile(tenantId, uploaderId, item, i, singleDeps, sessionToken);
    if (outcome.status === "session_expired") {
      // Nothing irreversible has been emitted yet: commit, enqueue and audit
      // wait until the whole batch passes, so rollback only removes rows,
      // blobs, and live reservations. AC-01.08 leaves no orphan job behind.
      // Best-effort: the primary outcome is SessionExpired, so a failing
      // delete or release must not mask it.
      await rollbackBatch(tenantId, createdDocuments, deps);
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
  // known good. api-specs/05-documents.md 5.2 deferred phase. AC-01.08.
  await emitPostBatch(tenantId, uploaderId, createdDocuments, deps);

  return ok({
    accepted,
    rejected,
    summary: buildBatchSummary(accepted, rejected),
    results,
  });
}
