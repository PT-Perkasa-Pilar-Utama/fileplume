import type { DocumentDetailView, DocumentId, Result, VersionId } from "@archiva/shared";
import { asVersionId, err } from "@archiva/shared";
import type * as E from "../errors.ts";
import type { AuditPort, BlobStore, Clock, JobQueue, QuotaPort } from "../ports.ts";
import type { AddVersionFailure, UploadInput, ViewerContext } from "../service.ts";
import { handleGetDocument } from "./get-document.ts";
import { prepareBlobUpload } from "./prepare-blob-upload.ts";
import { reportSettled } from "./report-settled.ts";
import type { CatalogRepository } from "./repository-types.ts";

export type AddVersionDeps = {
  repository: CatalogRepository;
  blobStore: BlobStore;
  quota: QuotaPort;
  queue: JobQueue;
  audit: AuditPort;
  clock: Clock;
};

export async function addVersion(
  documentId: DocumentId,
  input: UploadInput,
  deps: AddVersionDeps,
  viewer: ViewerContext,
  pendingConfirmationDays: number,
): Promise<Result<DocumentDetailView, AddVersionFailure>> {
  const precheck = await handleGetDocument(
    deps.repository,
    input.tenantId,
    documentId,
    viewer,
    pendingConfirmationDays,
    deps.clock.now(),
  );
  if (!precheck.ok) {
    return err({ kind: "NotFound" });
  }

  const versionId = asVersionId(crypto.randomUUID());

  const preparedRes = await prepareBlobUpload(input.tenantId, documentId, versionId, input, deps);
  if (!preparedRes.ok) {
    return preparedRes;
  }
  const prepared = preparedRes.value;

  const committed = { ...prepared.reservation, bytes: prepared.sizeBytes };
  try {
    await deps.quota.commitQuota(committed);
  } catch (commitErr) {
    reportSettled(
      await Promise.allSettled([
        deps.quota.releaseQuota(prepared.reservation),
        deps.blobStore.delete(prepared.blobKey),
      ]),
      "version compensation failed after quota commit",
    );
    throw commitErr;
  }

  const undo = async (msg: string): Promise<void> =>
    reportSettled(
      await Promise.allSettled([
        deps.quota.revertCommit(committed),
        deps.blobStore.delete(prepared.blobKey),
      ]),
      msg,
    );

  let insertResult: Result<
    { versionId: VersionId; versionNumber: number },
    E.IdenticalContent | E.DuplicateContent | E.NotFound
  >;
  try {
    insertResult = await deps.repository.insertVersionAndUpdateDocument(input.tenantId, {
      documentId,
      versionId,
      uploaderId: input.uploaderId,
      contentHash: prepared.sha256,
      blobKey: prepared.blobKey,
      filename: input.filename,
      mimeType: prepared.mimeType,
      sizeBytes: prepared.sizeBytes,
    });
  } catch (insertErr) {
    await undo("version compensation failed after insert throw");
    throw insertErr;
  }

  if (!insertResult.ok) {
    await undo("version compensation failed after refused insert");
    return insertResult;
  }

  await deps.queue.enqueue(documentId);
  // SCAFFOLD: removing the previous version's pages from the index (05-documents.md 5.7 step 7) lands in BE-S4-01.

  await deps.audit.record({
    tenantId: input.tenantId,
    actorId: input.uploaderId,
    action: "document.version_add",
    subjectType: "document",
    subjectId: documentId,
    outcome: "allowed",
    metadata: {
      filename: input.filename,
      sizeBytes: prepared.sizeBytes,
      mimeType: prepared.mimeType,
      versionNumber: insertResult.value.versionNumber,
    },
  });

  return handleGetDocument(
    deps.repository,
    input.tenantId,
    documentId,
    viewer,
    pendingConfirmationDays,
    deps.clock.now(),
  );
}
