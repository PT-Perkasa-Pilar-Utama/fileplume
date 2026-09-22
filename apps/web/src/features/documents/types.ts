import type { UploadBatch } from "@archiva/shared";

export type { UploadBatch };

export type TrayItemStatus = "uploading" | "accepted" | "rejected";

export type AcceptedFileType = "pdf" | "docx" | "xlsx" | "txt";

type AcceptedResult = Extract<UploadBatch["results"][number], { status: "accepted" }>;
type RejectedResult = Extract<UploadBatch["results"][number], { status: "rejected" }>;

export type TrayItemDocument = AcceptedResult["document"];
export type TrayItemError = RejectedResult["error"];

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

export interface UploadTransport {
  open(method: string, url: string): void;
  withCredentials?: boolean;
  upload?: {
    addEventListener(type: "progress", listener: (ev: ProgressEvent) => void): void;
  };
  onload?: (() => void) | null;
  onerror?: (() => void) | null;
  onabort?: (() => void) | null;
  status: number;
  responseText: string;
  send(body?: Document | XMLHttpRequestBodyInit | null): void;
}

export type UploadTransportConstructor = new () => UploadTransport;

export interface UploadDocumentsOptions {
  readonly onProgress?: UploadProgressCallback;
  readonly transport?: UploadTransportConstructor;
}

export interface UploadedDocumentDisplay {
  readonly id: string;
  readonly title: string;
  readonly fileType: AcceptedFileType | "other";
  readonly sizeBytes: number;
  readonly processingState: TrayItemDocument["processingState"];
  readonly processingLabel: string;
  readonly uploaderName: string;
  readonly createdAt: string;
}
