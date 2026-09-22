import {
  collectionOf,
  type DocumentView,
  dataOf,
  documentSchema,
  ERROR_MESSAGES,
  errorSchema,
  type ListDocumentsQuery,
  type Meta,
  type UploadBatch,
  uploadBatchSchema,
} from "@archiva/shared";
import { API_BASE, ApiError, apiFetch } from "../../lib/api.ts";
import type { UploadDocumentsOptions } from "./types.ts";

/**
 * Validates and extracts `UploadBatch` from a JSON response payload,
 * whether the server returned HTTP 201 (at least 1 accepted) or 422 (0 accepted,
 * per-file outcomes), as defined in api-specs/05-documents.md 5.2.
 */
export function parseUploadBatchBody(status: number, body: unknown): UploadBatch {
  if (status === 201 || status === 422) {
    const parsedData = dataOf(uploadBatchSchema).safeParse(body);
    if (parsedData.success) {
      return parsedData.data.data;
    }
  }

  const parsedError = errorSchema.safeParse(body);
  if (parsedError.success) {
    throw new ApiError(status, parsedError.data.error.code, parsedError.data.error.message);
  }

  if (status === 401) {
    throw new ApiError(401, "UNAUTHENTICATED", ERROR_MESSAGES.UNAUTHENTICATED);
  }

  throw new ApiError(status, "INTERNAL_ERROR", ERROR_MESSAGES.INTERNAL_ERROR);
}

/**
 * POST /api/v1/documents
 * Accepts 1 to 20 multipart parts, streams them to the server, and returns
 * per-file outcomes with a batch summary (api-specs/05-documents.md 5.2).
 * Tracks upload progress via XMLHttpRequest and completes progress at 100%.
 */
export async function uploadDocumentsRequest(
  files: File[],
  options?: UploadDocumentsOptions,
): Promise<UploadBatch> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  return new Promise<UploadBatch>((resolve, reject) => {
    const Transport = options?.transport ?? XMLHttpRequest;
    const xhr = new Transport();
    xhr.open("POST", `${API_BASE}/documents`);
    xhr.withCredentials = true;

    if (options?.onProgress && xhr.upload) {
      xhr.upload.addEventListener("progress", (event: ProgressEvent) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          options.onProgress?.({
            progress: percent,
            loadedBytes: event.loaded,
            totalBytes: event.total,
          });
        }
      });
    }

    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        return reject(new ApiError(xhr.status, "INTERNAL_ERROR", ERROR_MESSAGES.INTERNAL_ERROR));
      }

      try {
        const result = parseUploadBatchBody(xhr.status, body);
        // Indicate 100% progress on completion (AC-01.01)
        options?.onProgress?.({
          progress: 100,
          loadedBytes: totalBytes,
          totalBytes,
        });
        resolve(result);
      } catch (error: unknown) {
        reject(error);
      }
    };

    xhr.onerror = () => {
      reject(new ApiError(400, "UPLOAD_INTERRUPTED", ERROR_MESSAGES.UPLOAD_INTERRUPTED));
    };

    xhr.onabort = () => {
      reject(new ApiError(400, "UPLOAD_INTERRUPTED", ERROR_MESSAGES.UPLOAD_INTERRUPTED));
    };

    xhr.send(formData);
  });
}

export interface DocumentsResponse {
  readonly data: DocumentView[];
  readonly meta: Meta;
}

export type DocumentQueryParams = Partial<ListDocumentsQuery>;

/**
 * Builds URL search query string from ListDocumentsQuery params.
 * Repeated parameters (tags, state) are appended multiple times.
 */
export function buildDocumentSearchParams(params?: DocumentQueryParams): string {
  if (!params) return "";
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) {
    searchParams.set("page", String(params.page));
  }
  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sort !== undefined) {
    searchParams.set("sort", params.sort);
  }
  if (params.order !== undefined) {
    searchParams.set("order", params.order);
  }
  if (params.categoryId !== undefined) {
    searchParams.set("categoryId", params.categoryId);
  }
  if (params.uploaderId !== undefined) {
    searchParams.set("uploaderId", params.uploaderId);
  }
  if (params.unconfirmedOnly !== undefined) {
    searchParams.set("unconfirmedOnly", String(params.unconfirmedOnly));
  }
  if (params.tags !== undefined) {
    const tags = Array.isArray(params.tags) ? params.tags : [params.tags];
    for (const tag of tags) {
      searchParams.append("tags", tag);
    }
  }
  if (params.state !== undefined) {
    const states = Array.isArray(params.state) ? params.state : [params.state];
    for (const s of states) {
      searchParams.append("state", s);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

/**
 * Fetches documents collection from GET /api/v1/documents.
 * api-specs/05-documents.md 5.4.
 */
export async function fetchDocuments(params?: DocumentQueryParams): Promise<DocumentsResponse> {
  const query = buildDocumentSearchParams(params);
  return apiFetch(`/documents${query}`, collectionOf(documentSchema));
}
