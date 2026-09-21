/**
 * Formats batch upload summary.
 * AC-35.04 / 05-documents.md 5.2: Present only on a mixed batch, e.g.
 * "2 dari 3 file berhasil diunggah". Null when all succeeded or all failed.
 */
export function buildBatchSummary(accepted: number, rejected: number): string | null {
  if (accepted > 0 && rejected > 0) {
    return `${accepted} dari ${accepted + rejected} file berhasil diunggah`;
  }
  return null;
}
