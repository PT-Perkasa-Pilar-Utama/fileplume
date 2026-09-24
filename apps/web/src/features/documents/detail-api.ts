import {
  collectionOf,
  type DocumentDetailView,
  type DocumentVersionView,
  dataOf,
  documentDetailSchema,
  documentVersionSchema,
  ERROR_MESSAGES,
  errorSchema,
} from "@archiva/shared";
import { API_BASE, ApiError, apiFetch } from "../../lib/api.ts";

/**
 * Extracts filename from Content-Disposition header.
 * e.g. `attachment; filename="kontrak-kerjasama.pdf"`
 */
export function parseContentDispositionFilename(header: string | null | undefined): string | null {
  if (!header) return null;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const regularMatch = /filename="([^"]+)"/i.exec(header) || /filename=([^;\s]+)/i.exec(header);
  return regularMatch?.[1] ?? null;
}

/**
 * Triggers a file download in the browser using a temporary anchor element.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === "undefined" || !window.URL?.createObjectURL) return;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * GET /api/v1/documents/:id (api-specs/05-documents.md 5.5).
 * Retrieves full document detail with metadata and versions.
 */
export async function fetchDocumentDetail(id: string): Promise<DocumentDetailView> {
  const res = await apiFetch(`/documents/${id}`, dataOf(documentDetailSchema));
  return res.data;
}

/**
 * GET /api/v1/documents/:id/versions (api-specs/05-documents.md 5.6).
 * Retrieves all versions of a document in collection envelope, newest first.
 */
export async function fetchDocumentVersions(id: string): Promise<DocumentVersionView[]> {
  const res = await apiFetch(`/documents/${id}/versions`, collectionOf(documentVersionSchema));
  return res.data;
}

/**
 * GET /api/v1/documents/:id/preview?versionId=... (api-specs/05-documents.md 5.8).
 * Streams renderable bytes (PDF) to the client viewer without triggering download.
 */
export async function fetchDocumentPreview(
  id: string,
  versionId?: string,
): Promise<{ blob: Blob; url: string }> {
  const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : "";
  const res = await fetch(`${API_BASE}/documents/${id}/preview${query}`, {
    credentials: "include",
  });

  if (!res.ok) {
    let code: string = "INTERNAL_ERROR";
    let message: string = ERROR_MESSAGES.INTERNAL_ERROR;
    try {
      const json = await res.json();
      const parsed = errorSchema.safeParse(json);
      if (parsed.success) {
        code = parsed.data.error.code;
        message = parsed.data.error.message;
      }
    } catch {
      // Body is not JSON
    }
    throw new ApiError(res.status, code, message);
  }

  const blob = await res.blob();
  const url =
    typeof window !== "undefined" && window.URL?.createObjectURL
      ? window.URL.createObjectURL(blob)
      : "";
  return { blob, url };
}

/**
 * POST /api/v1/documents/:id/download (api-specs/05-documents.md 5.9).
 * Streams original file to the caller and records audit access.
 */
export async function downloadDocumentRequest(
  id: string,
  versionId?: string,
  defaultFilename = "document",
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${API_BASE}/documents/${id}/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ versionId }),
    credentials: "include",
  });

  if (!res.ok) {
    let code: string = "INTERNAL_ERROR";
    let message: string = ERROR_MESSAGES.INTERNAL_ERROR;
    try {
      const json = await res.json();
      const parsed = errorSchema.safeParse(json);
      if (parsed.success) {
        code = parsed.data.error.code;
        message = parsed.data.error.message;
      }
    } catch {
      // Body is not JSON
    }
    throw new ApiError(res.status, code, message);
  }

  const disposition = res.headers.get("Content-Disposition");
  const filename = parseContentDispositionFilename(disposition) ?? defaultFilename;
  const blob = await res.blob();
  return { blob, filename };
}
