import type { DocumentDetailView, DocumentId, Result } from "@archiva/shared";
import { asVersionId, err, ok } from "@archiva/shared";
import type * as E from "../errors.ts";
import type { AuditPort, BlobStore, Clock, JobQueue, QuotaPort } from "../ports.ts";
import type { UploadFailure, UploadInput } from "../service.ts";
import { blobKey } from "./blob-key.ts";
import { buildDocumentDetail } from "./build-document-detail.ts";
import type { CatalogRepository } from "./repository-types.ts";
import { sniffType } from "./sniff-type.ts";
import { readHeader } from "./upload-single-file.ts";

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
): Promise<Result<DocumentDetailView, E.IdenticalContent | E.NotFound | UploadFailure>> {
  const doc = await deps.repository.findDocument(input.tenantId, documentId);
  if (!doc) {
    return err({ kind: "NotFound" });
  }

  const [sniffStream, blobStream] = input.stream.tee();
  const header = await readHeader(sniffStream);
  const sniffResult = header.length > 0 ? sniffType(header) : null;
  if (!sniffResult) {
    return err({ kind: "UnsupportedType" });
  }

  const maxLimitMb = await deps.quota.getMaxFileSizeMb(input.tenantId);
  const maxLimitBytes = maxLimitMb * 1024 * 1024;
  if (input.sizeBytes > maxLimitBytes) {
    return err({ kind: "TooLarge", limitMb: maxLimitMb });
  }

  const resResult = await deps.quota.reserveQuota(input.tenantId, input.sizeBytes);
  if (!resResult.ok) {
    return err({ kind: "QuotaExceeded" });
  }
  const reservation = resResult.value;

  const versionId = asVersionId(crypto.randomUUID());
  const key = blobKey(input.tenantId, documentId, versionId);

  let blobOutcome: { sizeBytes: number; sha256: string };
  try {
    blobOutcome = await deps.blobStore.put(key, blobStream);
  } catch (blobErr) {
    await deps.quota.releaseQuota(reservation);
    await deps.blobStore.delete(key);
    throw blobErr;
  }

  // AC-21.03: Refuse identical content against the current version.
  if (doc.currentVersionHash && doc.currentVersionHash === blobOutcome.sha256) {
    await deps.quota.releaseQuota(reservation);
    await deps.blobStore.delete(key);
    return err({ kind: "IdenticalContent" });
  }

  // Check duplicate content elsewhere in the tenant.
  const existingDocId = await deps.repository.findByContentHash(input.tenantId, blobOutcome.sha256);
  if (existingDocId) {
    await deps.quota.releaseQuota(reservation);
    await deps.blobStore.delete(key);
    if (existingDocId === documentId) {
      return err({ kind: "IdenticalContent" });
    }
    return err({ kind: "DuplicateContent", existingDocumentId: existingDocId });
  }

  const insertResult = await deps.repository.insertVersionAndUpdateDocument(input.tenantId, {
    documentId,
    versionId,
    uploaderId: input.uploaderId,
    contentHash: blobOutcome.sha256,
    blobKey: key,
    filename: input.filename,
    mimeType: sniffResult.mimeType,
    sizeBytes: blobOutcome.sizeBytes,
  });

  if (!insertResult.ok) {
    await deps.quota.releaseQuota(reservation);
    await deps.blobStore.delete(key);
    return insertResult;
  }

  await deps.quota.commitQuota({ ...reservation, bytes: blobOutcome.sizeBytes });
  await deps.queue.enqueue(documentId);

  await deps.audit.record({
    tenantId: input.tenantId,
    actorId: input.uploaderId,
    action: "document.version_add",
    subjectType: "document",
    subjectId: documentId,
    outcome: "allowed",
    metadata: {
      filename: input.filename,
      sizeBytes: blobOutcome.sizeBytes,
      mimeType: sniffResult.mimeType,
      versionNumber: insertResult.value.versionNumber,
    },
  });

  const versions = (await deps.repository.listVersions(input.tenantId, documentId)) ?? [];
  const updatedDoc = (await deps.repository.findDocument(input.tenantId, documentId)) ?? doc;

  const detail = buildDocumentDetail(
    {
      id: updatedDoc.id,
      title: updatedDoc.title,
      processingState: updatedDoc.processingState,
      failureReason: updatedDoc.failureReason ?? null,
      uploaderId: updatedDoc.uploaderId ?? input.uploaderId,
      uploaderName: updatedDoc.uploaderName ?? "Unknown User",
      createdAt: updatedDoc.createdAt ?? deps.clock.now().toISOString(),
    },
    versions,
    sniffResult.mimeType,
  );

  return ok(detail);
}
