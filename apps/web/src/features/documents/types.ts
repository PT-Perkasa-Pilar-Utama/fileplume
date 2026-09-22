export type { UploadBatch } from "@archiva/shared";

export type TrayItemStatus = "uploading" | "accepted" | "rejected";

export type AcceptedFileType = "pdf" | "docx" | "xlsx" | "txt";

export interface TrayItemDocument {
  readonly id: string;
  readonly title: string;
  readonly processingState: string;
  readonly processingLabel: string;
}

export interface TrayItemError {
  readonly code: string;
  readonly message: string;
  readonly existingDocumentId?: string;
}

export interface TrayItem {
  readonly id: string;
  readonly file: File;
  readonly filename: string;
  readonly sizeBytes: number;
  readonly progress: number;
  readonly status: TrayItemStatus;
  readonly document?: TrayItemDocument;
  readonly error?: TrayItemError;
}

export interface UploadProgress {
  readonly progress: number;
  readonly loadedBytes: number;
  readonly totalBytes: number;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

export interface UploadDocumentsOptions {
  readonly onProgress?: UploadProgressCallback;
}

export interface UploadedDocumentDisplay {
  readonly id: string;
  readonly title: string;
  readonly fileType: AcceptedFileType | "other";
  readonly sizeBytes: number;
  readonly processingState: string;
  readonly processingLabel: string;
  readonly uploaderName: string;
  readonly createdAt: string;
}
