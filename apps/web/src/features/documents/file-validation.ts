import { ERROR_MESSAGES, formatErrorMessage } from "@archiva/shared";
import type { AcceptedFileType } from "./types.ts";

/** Maximum number of files permitted in a single upload batch (AC-01.05). */
export const MAX_BATCH_FILES = 20;

/** Default tenant max file size in megabytes (AC-01.06). */
export const DEFAULT_MAX_FILE_SIZE_MB = 20;

export const ACCEPTED_EXTENSIONS: readonly string[] = [".pdf", ".docx", ".xlsx", ".txt"];

const EXTENSION_MAP: Record<string, AcceptedFileType> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  txt: "txt",
};

const MIME_MAP: Record<string, AcceptedFileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
};

export function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return filename.slice(dotIndex + 1).toLowerCase();
}

/**
 * Checks filename extension to determine accepted file type (e.g. for display).
 */
export function getAcceptedFileTypeByName(filename: string): AcceptedFileType | null {
  const ext = getFileExtension(filename);
  return EXTENSION_MAP[ext] ?? null;
}

/**
 * Checks extension and MIME type to determine accepted file type.
 * Resilient to browser drag-and-drop MIME differences (AC-01.03).
 */
export function getAcceptedFileType(file: File): AcceptedFileType | null {
  const ext = getFileExtension(file.name);
  const mappedByExt = EXTENSION_MAP[ext];
  if (mappedByExt) return mappedByExt;

  if (file.type) {
    const mappedByMime = MIME_MAP[file.type.toLowerCase()];
    if (mappedByMime) return mappedByMime;
  }

  return null;
}

export type BatchCountValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly error: string };

export function validateBatchCount(count: number): BatchCountValidationResult {
  if (count > MAX_BATCH_FILES) {
    return {
      valid: false,
      error: ERROR_MESSAGES.BATCH_TOO_LARGE,
    };
  }
  return { valid: true };
}

export type FileValidationResult =
  | { readonly valid: true; readonly fileType: AcceptedFileType }
  | { readonly valid: false; readonly error: { readonly code: string; readonly message: string } };

/**
 * Pre-checks an individual file's type and size limit before dispatching to API.
 * Mirrors server validations (AC-01.03, AC-01.06).
 */
export function validateFile(
  file: File,
  maxFileSizeMb = DEFAULT_MAX_FILE_SIZE_MB,
): FileValidationResult {
  const fileType = getAcceptedFileType(file);
  if (!fileType) {
    return {
      valid: false,
      error: {
        code: "UNSUPPORTED_TYPE",
        message: ERROR_MESSAGES.UNSUPPORTED_TYPE,
      },
    };
  }

  const maxSizeBytes = maxFileSizeMb * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: formatErrorMessage("FILE_TOO_LARGE", { n: maxFileSizeMb }),
      },
    };
  }

  return { valid: true, fileType };
}
