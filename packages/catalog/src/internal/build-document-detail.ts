import {
  asVersionId,
  type DocumentDetailView,
  type DocumentVersionView,
  FAILURE_REASONS,
  type FailureReason,
  type ProcessingState,
} from "@archiva/shared";
import { mimeToFileType, processingStateToLabel } from "./mime-file-type.ts";

export type DocumentDetailRecord = {
  id: string;
  title: string;
  processingState: ProcessingState;
  failureReason: string | null;
  uploaderId: string;
  uploaderName: string;
  createdAt: string;
};

export type VersionRowRecord = {
  id: string;
  versionNumber: number;
  filename: string;
  sizeBytes: number;
  pageCount: number | null;
  createdAt: Date;
  uploaderId: string;
  uploaderName: string | null;
};

export function toVersionView(
  r: VersionRowRecord,
  currentVersionId: string | null,
  fallbackName = "Unknown User",
): DocumentVersionView {
  return {
    id: asVersionId(r.id),
    versionNumber: r.versionNumber,
    filename: r.filename,
    sizeBytes: r.sizeBytes,
    pageCount: r.pageCount,
    uploadedBy: { id: r.uploaderId, name: r.uploaderName ?? fallbackName },
    createdAt: r.createdAt.toISOString(),
    isCurrent: r.id === currentVersionId,
  };
}

function toFailureReason(reason: string | null): { code: FailureReason; message: string } | null {
  if (!reason) return null;
  for (const code of FAILURE_REASONS) {
    if (code === reason) return { code, message: reason };
  }
  return { code: "unreadable_content", message: reason };
}

/**
 * Builds DocumentDetailView from repository records. api-specs/05-documents.md 5.5.
 */
export function buildDocumentDetail(
  doc: DocumentDetailRecord,
  versions: DocumentVersionView[],
  currentMimeType = "application/pdf",
): DocumentDetailView {
  const currentVer = versions.find((v) => v.isCurrent) ?? versions[0];
  const filename = currentVer ? currentVer.filename : doc.title;
  const sizeBytes = currentVer ? currentVer.sizeBytes : 0;
  const pageCount = currentVer ? currentVer.pageCount : null;
  const versionNumber = currentVer ? currentVer.versionNumber : 1;

  return {
    id: doc.id,
    title: doc.title,
    filename,
    mimeType: currentMimeType,
    fileType: mimeToFileType(currentMimeType),
    sizeBytes,
    pageCount,
    versionNumber,
    versionCount: versions.length,
    processingState: doc.processingState,
    processingLabel: processingStateToLabel(doc.processingState),
    failureReason: toFailureReason(doc.failureReason),
    uploader: {
      id: doc.uploaderId,
      name: doc.uploaderName,
    },
    category: null,
    documentType: null,
    tags: [],
    downloadAllowed: true,
    createdAt: doc.createdAt,
    metadata: null,
    versions,
  };
}
