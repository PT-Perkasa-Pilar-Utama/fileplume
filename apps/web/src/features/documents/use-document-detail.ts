import { type DocumentDetailView, type DocumentVersionView, ERROR_MESSAGES } from "@archiva/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api.ts";
import {
  downloadDocumentRequest,
  fetchDocumentDetail,
  fetchDocumentPreview,
  triggerBlobDownload,
} from "./detail-api.ts";

export interface UseDocumentDetailOptions {
  readonly documentId?: string;
}

export interface UseDocumentDetailReturn {
  readonly document: DocumentDetailView | undefined;
  readonly activeVersion: DocumentVersionView | undefined;
  readonly activeVersionId: string;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | Error | null;
  readonly previewUrl: string | null;
  readonly isLoadingPreview: boolean;
  readonly previewError: ApiError | null;
  readonly isDownloading: boolean;
  readonly downloadError: string | null;
  readonly selectVersion: (version: DocumentVersionView) => void;
  readonly handleDownload: () => Promise<void>;
}

/**
 * Manages document detail, active version switching, preview loading,
 * and version-specific downloading (AC-38.02, AC-21.02).
 */
export function useDocumentDetail({
  documentId,
}: UseDocumentDetailOptions): UseDocumentDetailReturn {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const documentQuery = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => {
      if (!documentId) throw new Error("Document ID is required");
      return fetchDocumentDetail(documentId);
    },
    enabled: Boolean(documentId),
  });

  const doc = documentQuery.data;

  // Determine active version: selected version or current / latest version
  const activeVersion = doc?.versions.find(
    (v) =>
      v.id ===
      (selectedVersionId ?? doc.versions.find((item) => item.isCurrent)?.id ?? doc.versions[0]?.id),
  );

  const activeVersionId = activeVersion?.id ?? selectedVersionId ?? "";

  // Preview query for active version
  const previewQuery = useQuery({
    queryKey: ["document-preview", documentId, activeVersion?.id],
    queryFn: async () => {
      if (!documentId || !activeVersion) return null;
      return fetchDocumentPreview(documentId, activeVersion.id);
    },
    enabled: Boolean(documentId && activeVersion?.id),
    staleTime: 1000 * 60 * 5,
  });

  // Revoke preview object URL on unmount or URL change
  useEffect(() => {
    const url = previewQuery.data?.url;
    return () => {
      if (url && typeof window !== "undefined" && window.URL?.revokeObjectURL) {
        window.URL.revokeObjectURL(url);
      }
    };
  }, [previewQuery.data?.url]);

  // Download mutation (AC-21.02)
  const downloadMutation = useMutation({
    mutationFn: async () => {
      if (!documentId || !activeVersion) return;
      const targetFilename = activeVersion.filename || doc?.title || "document";
      const { blob, filename } = await downloadDocumentRequest(
        documentId,
        activeVersion.id,
        targetFilename,
      );
      triggerBlobDownload(blob, filename);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : ERROR_MESSAGES.INTERNAL_ERROR;
      setDownloadError(msg);
    },
  });

  const selectVersion = (version: DocumentVersionView): void => {
    setSelectedVersionId(version.id);
    setDownloadError(null);
  };

  const handleDownload = async (): Promise<void> => {
    setDownloadError(null);
    await downloadMutation.mutateAsync();
  };

  const previewError =
    previewQuery.error instanceof ApiError
      ? previewQuery.error
      : previewQuery.error
        ? new ApiError(500, "INTERNAL_ERROR", previewQuery.error.message)
        : null;

  return {
    document: doc,
    activeVersion,
    activeVersionId,
    isLoading: documentQuery.isLoading,
    isError: documentQuery.isError,
    error: (documentQuery.error as ApiError | Error | null) ?? null,
    previewUrl: previewQuery.data?.url ?? null,
    isLoadingPreview: previewQuery.isLoading,
    previewError,
    isDownloading: downloadMutation.isPending,
    downloadError,
    selectVersion,
    handleDownload,
  };
}
