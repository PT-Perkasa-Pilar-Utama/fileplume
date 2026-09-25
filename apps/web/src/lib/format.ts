export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const unit = units[i] ?? "B";

  if (i === 0) return `${bytes} B`;

  const value = bytes / k ** i;
  return `${value.toFixed(1)} ${unit}`;
}

export function formatStorage(usedBytes: number, quotaBytes: number, percent?: number): string {
  const formattedUsed = formatBytes(usedBytes);
  const formattedQuota = formatBytes(quotaBytes);
  const pct = percent !== undefined ? percent : Math.round((usedBytes / quotaBytes) * 100);

  return `${formattedUsed} / ${formattedQuota} (${pct}%)`;
}

/**
 * Formats an ISO timestamp or date string into Indonesian short date (AC-38.01, AC-01.02).
 * Example: "2026-09-01T10:00:00.000Z" -> "1 Sep 2026"
 */
export function formatDocumentDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
