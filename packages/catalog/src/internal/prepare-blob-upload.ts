import type { DocumentId, Result, TenantId, VersionId } from "@archiva/shared";
import { err, ok } from "@archiva/shared";
import type * as E from "../errors.ts";
import type { BlobStore, QuotaPort, QuotaReservationToken } from "../ports.ts";
import type { UploadSingleFileItem } from "../service.ts";
import { blobKey } from "./blob-key.ts";
import { reportSettled } from "./report-settled.ts";
import { sniffType } from "./sniff-type.ts";

/** Header window for magic-byte sniffing. DOCX/XLSX markers sit kilobytes deep. */
const SNIFF_LIMIT_BYTES = 65536;

/**
 * Reads up to the sniff window from a tee branch. The blob branch still
 * carries the full stream, so header reads never consume file bytes.
 */
export async function readHeader(branch: ReadableStream): Promise<Uint8Array> {
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

export type PreparedBlobUpload = {
  blobKey: string;
  reservation: QuotaReservationToken;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

export type PrepareBlobUploadDeps = {
  blobStore: BlobStore;
  quota: QuotaPort;
};

/**
 * Shared sequence for sniffing, size checking, quota reservation, and blob streaming (F5).
 */
export async function prepareBlobUpload(
  tenantId: TenantId,
  documentId: DocumentId,
  versionId: VersionId,
  item: UploadSingleFileItem,
  deps: PrepareBlobUploadDeps,
): Promise<Result<PreparedBlobUpload, E.UnsupportedType | E.TooLarge | E.QuotaExceeded>> {
  const [sniffStream, blobStream] = item.stream.tee();
  const header = await readHeader(sniffStream);

  // technical-specs/07-security.md 7.5: never trust filename extension or client MIME.
  const sniffResult = header.length > 0 ? sniffType(header) : null;
  if (!sniffResult) {
    return err({ kind: "UnsupportedType" });
  }

  const maxLimitMb = await deps.quota.getMaxFileSizeMb(tenantId);
  const maxLimitBytes = maxLimitMb * 1024 * 1024;
  if (item.sizeBytes > maxLimitBytes) {
    return err({ kind: "TooLarge", limitMb: maxLimitMb });
  }

  const reservationResult = await deps.quota.reserveQuota(tenantId, item.sizeBytes);
  if (!reservationResult.ok) {
    return err({ kind: "QuotaExceeded" });
  }
  const reservation = reservationResult.value;

  const key = blobKey(tenantId, documentId, versionId);

  let blobOutcome: { sizeBytes: number; sha256: string };
  try {
    blobOutcome = await deps.blobStore.put(key, blobStream);
  } catch (blobErr) {
    reportSettled(
      await Promise.allSettled([deps.quota.releaseQuota(reservation), deps.blobStore.delete(key)]),
      "upload compensation failed after blob put failure",
    );
    throw blobErr;
  }

  return ok({
    blobKey: key,
    reservation,
    mimeType: sniffResult.mimeType,
    sizeBytes: blobOutcome.sizeBytes,
    sha256: blobOutcome.sha256,
  });
}
