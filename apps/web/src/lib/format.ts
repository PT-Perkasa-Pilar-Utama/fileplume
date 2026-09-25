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

/** Formats an ISO 8601 timestamp string into standard Indonesian date format in UTC. */
export function formatDocumentDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = months[date.getUTCMonth()] ?? "";
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
}
