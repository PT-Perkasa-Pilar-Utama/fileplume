import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../../../lib/api.ts";
import { uploadDocumentsRequest } from "../api.ts";
import type { TrayItem, UploadBatch, UploadProgress } from "../types.ts";
import { DEFAULT_MAX_FILE_SIZE_MB, validateBatchCount, validateFile } from "./file-validation.ts";

export interface FileToUpload {
  readonly file: File;
  readonly tempId: string;
}

export interface ProcessFilesResult {
  readonly batchError?: string;
  readonly newItems: readonly TrayItem[];
  readonly filesToUpload: readonly FileToUpload[];
}

/**
 * Pre-checks and prepares files dropped into the upload tray (AC-01.03, AC-01.05, AC-01.06).
 */
export function processFilesForUpload(
  files: readonly File[],
  maxFileSizeMb = DEFAULT_MAX_FILE_SIZE_MB,
  timestamp = Date.now(),
): ProcessFilesResult {
  const countCheck = validateBatchCount(files.length);
  if (!countCheck.valid) {
    return {
      batchError: countCheck.error ?? "Maksimal 20 file per unggahan",
      newItems: [],
      filesToUpload: [],
    };
  }

  const newItems: TrayItem[] = [];
  const filesToUpload: FileToUpload[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;

    const tempId = `${timestamp}-${i}-${file.name}`;
    const validation = validateFile(file, maxFileSizeMb);

    if (!validation.valid) {
      newItems.push({
        id: tempId,
        file,
        filename: file.name,
        sizeBytes: file.size,
        progress: 0,
        status: "rejected",
        error: validation.error,
      });
    } else {
      newItems.push({
        id: tempId,
        file,
        filename: file.name,
        sizeBytes: file.size,
        progress: 0,
        status: "uploading",
      });
      filesToUpload.push({ file, tempId });
    }
  }

  return { newItems, filesToUpload };
}

/**
 * Maps server-returned batch results to tray items, including duplicate links (5.2 & AC-03.01).
 */
export function applyBatchOutcomeToItems(
  items: readonly TrayItem[],
  batch: UploadBatch,
  filesToUpload: readonly FileToUpload[],
): readonly TrayItem[] {
  return items.map((item) => {
    const uploadIndex = filesToUpload.findIndex((f) => f.tempId === item.id);
    if (uploadIndex === -1) return item;

    const result = batch.results[uploadIndex];
    if (!result) return item;

    if (result.status === "accepted") {
      return {
        ...item,
        status: "accepted",
        progress: 100,
        document: result.document,
        error: undefined,
      };
    }

    return {
      ...item,
      status: "rejected",
      error: result.error,
    };
  });
}

export interface UseUploadTrayOptions {
  readonly onUploadSettled?: (batch: UploadBatch) => void;
  readonly maxFileSizeMb?: number;
  readonly initialItems?: readonly TrayItem[];
  readonly uploader?: (
    files: File[],
    options?: { onProgress?: (p: UploadProgress) => void },
  ) => Promise<UploadBatch>;
}

export interface UseUploadTrayReturn {
  readonly items: readonly TrayItem[];
  readonly isUploading: boolean;
  readonly batchError: string | null;
  readonly batchSummary: string | null;
  readonly successMessage: string | null;
  readonly handleFiles: (files: File[]) => Promise<void>;
  readonly handleDismiss: (id: string) => void;
  readonly clearError: () => void;
}

export function useUploadTray({
  onUploadSettled,
  maxFileSizeMb = DEFAULT_MAX_FILE_SIZE_MB,
  initialItems = [],
  uploader = uploadDocumentsRequest,
}: UseUploadTrayOptions = {}): UseUploadTrayReturn {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<TrayItem[]>([...initialItems]);
  const [isUploading, setIsUploading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchSummary, setBatchSummary] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFiles = async (files: File[]): Promise<void> => {
    setBatchError(null);
    setBatchSummary(null);
    setSuccessMessage(null);

    const processed = processFilesForUpload(files, maxFileSizeMb);

    if (processed.batchError) {
      setBatchError(processed.batchError);
      return;
    }

    setItems((prev) => [...processed.newItems, ...prev]);

    if (processed.filesToUpload.length === 0) {
      return;
    }

    setIsUploading(true);

    try {
      const validFiles = processed.filesToUpload.map((entry) => entry.file);

      const batch = await uploader(validFiles, {
        onProgress: (progressData: UploadProgress) => {
          setItems((prev) =>
            prev.map((item) => {
              const matched = processed.filesToUpload.some((f) => f.tempId === item.id);
              if (matched && item.status === "uploading") {
                return { ...item, progress: progressData.progress };
              }
              return item;
            }),
          );
        },
      });

      setItems((prev) => [...applyBatchOutcomeToItems(prev, batch, processed.filesToUpload)]);

      if (batch.summary) {
        setBatchSummary(batch.summary);
      }

      if (batch.accepted > 0) {
        setSuccessMessage("File diterima untuk diproses");
      }

      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["storage"] });

      onUploadSettled?.(batch);
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : "Unggahan terputus. Silakan coba lagi";

      setBatchError(message);

      setItems((prev) =>
        prev.map((item) => {
          const matched = processed.filesToUpload.some((f) => f.tempId === item.id);
          if (matched && item.status === "uploading") {
            return {
              ...item,
              status: "rejected",
              error: { code: "UPLOAD_ERROR", message },
            };
          }
          return item;
        }),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDismiss = (id: string): void => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearError = (): void => {
    setBatchError(null);
  };

  return {
    items,
    isUploading,
    batchError,
    batchSummary,
    successMessage,
    handleFiles,
    handleDismiss,
    clearError,
  };
}
