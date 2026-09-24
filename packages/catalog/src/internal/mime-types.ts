export const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
] as const;

/** Decided by magic-byte sniffing upstream, never by the extension. */
export function isAcceptedType(mimeType: string): boolean {
  return ACCEPTED_MIME.some((accepted) => accepted === mimeType);
}
