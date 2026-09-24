import type { TenantId, UserId } from "@archiva/shared";
import { asDocumentId, asVersionId, ERROR_MESSAGES, formatErrorMessage } from "@archiva/shared";
import type { BlobStore, QuotaPort, QuotaReservationToken, SessionPort } from "../ports.ts";
import type { CatalogRepository } from "../repository.ts";
import type {
  UploadAcceptedResult,
  UploadRejectedResult,
  UploadSingleFileItem,
} from "../service.ts";
import { blobKey } from "./blob-key.ts";
import { sniffType } from "./sniff-type.ts";

/** Header window for magic-byte sniffing. DOCX/XLSX markers sit kilobytes deep. */
const SNIFF_LIMIT_BYTES = 65536;

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
  session?: SessionPort;
};

/**
 * Reads up to the sniff window from a tee branch. The blob branch still
 * carries the full stream, so header reads never consume file bytes.
 */
async function readHeader(branch: ReadableStream): Promise<Uint8Array> {
  const reader = branch.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
      if (total >= SNIFF_LIMIT_BYTES) break;
    }
  } finally {
    // Awaiting cancel on a tee branch hangs in Bun, but the branch must be
    // cancelled or the tee queues every remaining chunk for a reader that
    // never returns. The blob branch still carries the full stream.
    reader.releaseLock();
    void branch.cancel();
  }
  const header = new Uint8Array(Math.min(total, SNIFF_LIMIT_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const room = header.length - offset;
    if (room <= 0) break;
    header.set(chunk.subarray(0, room), offset);
    offset += Math.min(chunk.byteLength, room);
  }
  return header;
}

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
  const [sniffStream, blobStream] = item.stream.tee();
  const header = await readHeader(sniffStream);

  // technical-specs/07-security.md 7.5: never trust filename extension or client MIME.
  const sniffResult = header.length > 0 ? sniffType(header) : null;
  if (!sniffResult) {
    return rejected(index, item.filename, {
      code: "UNSUPPORTED_TYPE",
      message: ERROR_MESSAGES.UNSUPPORTED_TYPE,
    });
  }

  const maxLimitMb = await deps.quota.getMaxFileSizeMb(tenantId);
  const maxLimitBytes = maxLimitMb * 1024 * 1024;
  if (item.sizeBytes > maxLimitBytes) {
    return rejected(index, item.filename, {
      code: "FILE_TOO_LARGE",
      message: formatErrorMessage("FILE_TOO_LARGE", { n: maxLimitMb }),
    });
  }

  const reservationResult = await deps.quota.reserveQuota(tenantId, item.sizeBytes);
  if (!reservationResult.ok) {
    return rejected(index, item.filename, {
      code: "QUOTA_EXCEEDED",
      message: ERROR_MESSAGES.QUOTA_EXCEEDED,
    });
  }
  const reservation = reservationResult.value;

  const documentId = asDocumentId(crypto.randomUUID());
  const versionId = asVersionId(crypto.randomUUID());
  const key = blobKey(tenantId, documentId, versionId);

  let blobOutcome: { sizeBytes: number; sha256: string };
  try {
    blobOutcome = await deps.blobStore.put(key, blobStream);
  } catch (blobErr) {
    await deps.quota.releaseQuota(reservation);
    await deps.blobStore.delete(key);
    throw blobErr;
  }

  // AC-01.08, api-specs/02-authentication.md 2.5, 05-documents.md 5.2:
  // Session resolved before the first byte and again before commit, so an
  // expiring session leaves nothing behind.
  const token = item.sessionToken ?? sessionToken;
  if (token !== undefined && deps.session !== undefined) {
    const isLive = await deps.session.validateSession(token);
    if (!isLive) {
      // Best-effort compensation: the primary outcome is session_expired, so
      // a failing delete or release must not mask it. Leftovers are reclaimed
      // by the reservation sweeper and orphan-blob collection, never surfaced.
      await Promise.allSettled([deps.quota.releaseQuota(reservation), deps.blobStore.delete(key)]);
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
    mimeType: sniffResult.mimeType,
    sizeBytes: blobOutcome.sizeBytes,
  });

  if (!insertResult.ok) {
    // Best-effort compensation for the losing writer: DUPLICATE_CONTENT is the
    // primary outcome, so cleanup failures must not mask it. AC-03.04.
    await Promise.allSettled([deps.quota.releaseQuota(reservation), deps.blobStore.delete(key)]);
    const duplicate = insertResult.error;
    return rejected(index, item.filename, {
      code: "DUPLICATE_CONTENT",
      message: ERROR_MESSAGES.DUPLICATE_CONTENT,
      ...(duplicate.existingDocumentId ? { existingDocumentId: duplicate.existingDocumentId } : {}),
    });
  }

  // Commit what the blob store actually wrote, not the declared size,
  // so route-level streaming never drifts quota.
  await deps.quota.commitQuota({ ...reservation, bytes: blobOutcome.sizeBytes });

  // No enqueue or audit here: both are irreversible, so uploadBatch emits them
  // only after every file in the batch has passed the session check. AC-01.08.
  return {
    index,
    filename: item.filename,
    status: "accepted",
    blobKey: key,
    reservation,
    mimeType: sniffResult.mimeType,
    sizeBytes: blobOutcome.sizeBytes,
    document: {
      id: documentId,
      title: item.filename,
      processingState: "queued",
      processingLabel: "Antre",
    },
  };
}
