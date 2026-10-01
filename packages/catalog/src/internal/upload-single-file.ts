import type { TenantId, UserId } from "@archiva/shared";
import { asDocumentId, asVersionId, ERROR_MESSAGES, formatErrorMessage } from "@archiva/shared";
import type { BlobStore, QuotaPort, QuotaReservationToken, SessionPort } from "../ports.ts";
import type { CatalogRepository } from "../repository.ts";
import type {
  UploadAcceptedResult,
  UploadRejectedResult,
  UploadSingleFileItem,
} from "../service.ts";
import { prepareBlobUpload, readHeader } from "./prepare-blob-upload.ts";
import { reportSettled } from "./report-settled.ts";

export { readHeader };

export type SingleUploadAccepted = UploadAcceptedResult & {
  blobKey: string;
  reservation: QuotaReservationToken;
  mimeType: string;
  sizeBytes: number;
};

export type SingleUploadOutcome =
  | SingleUploadAccepted
  | UploadRejectedResult
  | { status: "session_expired" };

export type UploadSingleFileDeps = {
  repository: CatalogRepository;
  blobStore: BlobStore;
  quota: QuotaPort;
  session: SessionPort;
};

function rejected(
  index: number,
  filename: string,
  error: UploadRejectedResult["error"],
): UploadRejectedResult {
  return { index, filename, status: "rejected", error };
}

export async function uploadSingleFile(
  tenantId: TenantId,
  uploaderId: UserId,
  item: UploadSingleFileItem,
  index: number,
  deps: UploadSingleFileDeps,
  sessionToken?: string,
): Promise<SingleUploadOutcome> {
  const documentId = asDocumentId(crypto.randomUUID());
  const versionId = asVersionId(crypto.randomUUID());

  const prepRes = await prepareBlobUpload(tenantId, documentId, versionId, item, deps);
  if (!prepRes.ok) {
    switch (prepRes.error.kind) {
      case "UnsupportedType":
        return rejected(index, item.filename, {
          code: "UNSUPPORTED_TYPE",
          message: ERROR_MESSAGES.UNSUPPORTED_TYPE,
        });
      case "TooLarge":
        return rejected(index, item.filename, {
          code: "FILE_TOO_LARGE",
          message: formatErrorMessage("FILE_TOO_LARGE", { n: prepRes.error.limitMb }),
        });
      case "QuotaExceeded":
        return rejected(index, item.filename, {
          code: "QUOTA_EXCEEDED",
          message: ERROR_MESSAGES.QUOTA_EXCEEDED,
        });
    }
  }

  const prepared = prepRes.value;
  const key = prepared.blobKey;
  const reservation = prepared.reservation;
  const blobOutcome = { sizeBytes: prepared.sizeBytes, sha256: prepared.sha256 };
  const mimeType = prepared.mimeType;

  // AC-01.08, api-specs/02-authentication.md 2.5, 05-documents.md 5.2:
  // Session resolved before the first byte and again before commit, so an
  // expiring session leaves nothing behind.
  if (sessionToken !== undefined) {
    if (!(await deps.session.validateSession(sessionToken))) {
      // Best-effort compensation: the primary outcome is session_expired, so
      // a failing delete or release must not mask it. Leftovers are reclaimed
      // by the reservation sweeper and orphan-blob collection, never surfaced.
      reportSettled(
        await Promise.allSettled([
          deps.quota.releaseQuota(reservation),
          deps.blobStore.delete(key),
        ]),
        "upload compensation failed after session expiry",
      );
      return { status: "session_expired" };
    }
  }

  const insertResult = await deps.repository.insertDocumentWithVersion(tenantId, {
    documentId,
    versionId,
    uploaderId,
    contentHash: blobOutcome.sha256,
    blobKey: key,
    filename: item.filename,
    mimeType,
    sizeBytes: blobOutcome.sizeBytes,
  });

  if (!insertResult.ok) {
    // Best-effort compensation for the losing writer: DUPLICATE_CONTENT is the
    // primary outcome, so cleanup failures must not mask it. AC-03.04.
    reportSettled(
      await Promise.allSettled([deps.quota.releaseQuota(reservation), deps.blobStore.delete(key)]),
      "upload compensation failed after duplicate insert",
    );
    const duplicate = insertResult.error;
    return rejected(index, item.filename, {
      code: "DUPLICATE_CONTENT",
      message: ERROR_MESSAGES.DUPLICATE_CONTENT,
      ...(duplicate.existingDocumentId ? { existingDocumentId: duplicate.existingDocumentId } : {}),
    });
  }

  // CODING_STANDARD.md 7.3, AC-35.04: the reservation commits as soon as its
  // file lands, never held open across the batch. A slow batch can therefore
  // never outlive the 15-minute reservation TTL into over-allocation, and the
  // batch rollback debits committed bytes back through `revertCommit`.
  try {
    await deps.quota.commitQuota({ ...reservation, bytes: blobOutcome.sizeBytes });
  } catch (commitErr) {
    // The commit is transactional: a throw leaves the reservation open, so
    // release it and remove the row and blob, then let the throw surface.
    reportSettled(
      await Promise.allSettled([
        deps.quota.releaseQuota(reservation),
        deps.blobStore.delete(key),
        deps.repository.deleteDocument(tenantId, documentId),
      ]),
      "upload compensation failed after quota commit",
    );
    throw commitErr;
  }

  // No enqueue or audit here. A queue job cannot be taken back, so uploadBatch
  // holds those two until every file in the batch has passed the session
  // check. The quota commit above is reversible through `revertCommit`, which
  // is what lets the rollback debit files committed before a later session
  // expiry. AC-01.08.
  return {
    index,
    filename: item.filename,
    status: "accepted",
    blobKey: key,
    reservation,
    mimeType,
    sizeBytes: blobOutcome.sizeBytes,
    document: {
      id: documentId,
      title: item.filename,
      processingState: "queued",
      processingLabel: "Antre",
    },
  };
}
