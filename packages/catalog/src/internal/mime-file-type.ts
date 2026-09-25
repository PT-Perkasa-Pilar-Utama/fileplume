import type { FileType, ProcessingState } from "@archiva/shared";

/** Maps sniffed MIME type to the four accepted file types in 5.1. */
export function mimeToFileType(mime: string): FileType {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return "xlsx";
    case "text/plain":
      return "txt";
    default:
      return "pdf";
  }
}

/** Labels are served, never mapped client-side. CLAUDE.md 5.2. */
export function processingStateToLabel(state: ProcessingState): string {
  switch (state) {
    case "queued":
      return "Antre";
    case "processing":
      return "Diproses";
    case "ready":
      return "Siap";
    case "failed":
      return "Gagal";
  }
}
