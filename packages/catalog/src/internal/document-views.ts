import type {
  DocumentDetailView,
  DocumentId,
  DocumentVersionView,
  DocumentView,
  FailureReason,
  FileType,
  ProcessingState,
  TenantId,
  UserId,
  VersionId,
} from "@archiva/shared";
import { EMPTY_STATE } from "@archiva/shared";

export const FAILURE_MESSAGES: Record<FailureReason, string> = {
  password_protected: "Dokumen terproteksi password",
  unreadable_content: "Isi dokumen tidak dapat dibaca",
  extraction_timeout: "Proses ekstraksi melebihi batas waktu",
  ai_unavailable: "Layanan AI tidak tersedia",
  index_failed: "Dokumen gagal diindeks",
};

export const PROCESSING_LABELS: Record<ProcessingState, string> = {
  queued: "Antre",
  processing: "Diproses",
  ready: "Siap",
  failed: "Gagal",
};

export type RawVersionRow = {
  id: VersionId;
  versionNumber: number;
  filename: string;
  sizeBytes: number;
  pageCount: number | null;
  uploadedById: UserId;
  uploadedByName: string;
  createdAt: Date;
  isCurrent: boolean;
};

export type RawDocumentRow = {
  id: DocumentId;
  tenantId: TenantId;
  title: string;
  currentVersionId: VersionId | null;
  processingState: ProcessingState;
  failureReason: FailureReason | null;
  createdAt: Date;
  uploaderId: UserId;
  uploaderName: string;
  versionNumber: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number | null;
  versionCount: number;
  categoryId: string | null;
  categoryName: string | null;
  categoryIsSystem: boolean | null;
  categoryConfirmedAt: Date | null;
  categoryDownloadActive: boolean | null;
  documentType: string | null;
  tags: string[];
};

export type RawDocumentDetail = RawDocumentRow & {
  author: string | null;
  documentCreatedAt: Date | null;
  versions: RawVersionRow[];
};

/** Derived from sniffed mimeType, driving the card icon (AC-38.01, 05-documents.md 5.1). */
export function fileTypeFromMime(mimeType: string): FileType {
  switch (mimeType) {
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

/** Served Indonesian label for document state (05-documents.md 5.1.1). */
export function formatProcessingLabel(state: ProcessingState): string {
  return PROCESSING_LABELS[state] ?? state;
}

/** Formatted failure reason object or null (05-documents.md 5.1.1). */
export function formatFailureReason(
  state: ProcessingState,
  code: FailureReason | null,
): { code: FailureReason; message: string } | null {
  if (state !== "failed" || !code) return null;
  const message = FAILURE_MESSAGES[code] ?? code;
  return { code, message };
}

/**
 * Empty-state message selection according to 01-conventions.md 1.5.1 and 05-documents.md 5.4 step 4.
 */
export function selectEmptyMessage(options: {
  tenantTotal: number;
  categoryId?: string;
  tags?: string[];
  unconfirmedOnly?: boolean;
}): string | null {
  if (options.tenantTotal === 0) {
    return EMPTY_STATE.NO_DOCUMENTS;
  }
  if (options.categoryId) {
    return EMPTY_STATE.NO_DOCUMENTS_IN_CATEGORY;
  }
  if (options.tags && options.tags.length > 0) {
    return EMPTY_STATE.NO_DOCUMENTS_FOR_TAGS;
  }
  if (options.unconfirmedOnly) {
    return EMPTY_STATE.NO_UNCONFIRMED;
  }
  return null;
}

export function toDocumentView(row: RawDocumentRow): DocumentView {
  return {
    id: row.id,
    title: row.title,
    filename: row.filename,
    mimeType: row.mimeType,
    fileType: fileTypeFromMime(row.mimeType),
    sizeBytes: row.sizeBytes,
    pageCount: row.pageCount,
    versionNumber: row.versionNumber,
    versionCount: row.versionCount,
    processingState: row.processingState,
    processingLabel: formatProcessingLabel(row.processingState),
    failureReason: formatFailureReason(row.processingState, row.failureReason),
    uploader: {
      id: row.uploaderId,
      name: row.uploaderName,
    },
    category:
      row.categoryId && row.categoryName
        ? {
            id: row.categoryId,
            name: row.categoryName,
            isSuggestion: row.categoryConfirmedAt === null,
            isSystem: row.categoryIsSystem ?? false,
          }
        : null,
    documentType: row.documentType,
    tags: row.tags.slice(0, 3),
    downloadAllowed: row.categoryDownloadActive ?? false,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toDocumentVersionView(ver: RawVersionRow): DocumentVersionView {
  return {
    id: ver.id,
    versionNumber: ver.versionNumber,
    filename: ver.filename,
    sizeBytes: ver.sizeBytes,
    pageCount: ver.pageCount,
    uploadedBy: {
      id: ver.uploadedById,
      name: ver.uploadedByName,
    },
    createdAt: ver.createdAt.toISOString(),
    isCurrent: ver.isCurrent,
  };
}

export function toDocumentDetailView(detail: RawDocumentDetail): DocumentDetailView {
  const base = toDocumentView(detail);
  return {
    ...base,
    metadata: {
      author: detail.author,
      documentCreatedAt: detail.documentCreatedAt ? detail.documentCreatedAt.toISOString() : null,
    },
    versions: detail.versions.map(toDocumentVersionView),
  };
}
