import { type DocumentDetailView, type DocumentVersionView, ERROR_MESSAGES } from "@archiva/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api.ts";
import { invalidateStorage } from "../storage/api.ts";
import {
  downloadDocumentRequest,
  fetchDocumentDetail,
  fetchDocumentPreview,
  triggerBlobDownload,
  uploadDocumentVersionRequest,
} from "./detail-api.ts";
import { DOCUMENTS_QUERY_KEY } from "./use-documents.ts";
import { useProcessingStatus } from "./use-processing-status.ts";

export const DOCUMENT_QUERY_KEY = ["document"] as const;

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
  readonly uploadVersion: (file: File) => Promise<DocumentDetailView>;
}

/**
 * Manages document detail, active version switching, preview loading,
 * version-specific downloading, and processing status polling (AC-38.02, AC-21.02, AC-44.01).
 * Uses shared useProcessingStatus to avoid polling heavy detail payload (api-specs 07.2).
 */
export function useDocumentDetail({
  documentId,
}: UseDocumentDetailOptions): UseDocumentDetailReturn {
  const queryClient = useQueryClient();
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const documentQuery = useQuery({
    queryKey: [...DOCUMENT_QUERY_KEY, documentId],
    queryFn: () => {
      if (!documentId) throw new Error("Document ID is required");
      return fetchDocumentDetail(documentId);
    },
    enabled: Boolean(documentId),
  });

  const doc = documentQuery.data;

  const isPendingProcessing =
    doc?.processingState === "queued" || doc?.processingState === "processing";

  const processingStatus = useProcessingStatus({
    documentId,
    initialState: doc?.processingState,
    initialLabel: doc?.processingLabel,
    initialFailureReason: doc?.failureReason,
    enabled: Boolean(documentId && doc && isPendingProcessing),
    onStatusChange: (status) => {
      if (status.state === "ready" || status.state === "failed") {
        void queryClient.invalidateQueries({
          queryKey: [...DOCUMENT_QUERY_KEY, documentId],
        });
      }
    },
  });

  const is404Purged =
    processingStatus.isError &&
    processingStatus.error instanceof ApiError &&
    processingStatus.error.status === 404;

  const isError = Boolean(documentQuery.isError || is404Purged);

  const effectiveError = is404Purged
    ? processingStatus.error
    : (documentQuery.error ?? processingStatus.error);

  const effectiveDocument: DocumentDetailView | undefined =
    is404Purged || !doc
      ? undefined
      : {
          ...doc,
          processingState: processingStatus.state ?? doc.processingState,
          processingLabel: processingStatus.label ?? doc.processingLabel,
          failureReason:
            processingStatus.failureReason !== undefined
              ? processingStatus.failureReason
              : doc.failureReason,
        };

  const activeVersion = effectiveDocument?.versions.find(
    (v) =>
      v.id ===
      (selectedVersionId ??
        effectiveDocument.versions.find((item) => item.isCurrent)?.id ??
        effectiveDocument.versions[0]?.id),
  );

  const activeVersionId = activeVersion?.id ?? selectedVersionId ?? "";

  const previewQuery = useQuery({
    queryKey: ["document-preview", documentId, activeVersion?.id],
    queryFn: async () => {
      if (!documentId || !activeVersion) return null;
      return fetchDocumentPreview(documentId, activeVersion.id);
    },
    enabled: Boolean(documentId && activeVersion?.id),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const url = previewQuery.data?.url;
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [previewQuery.data?.url]);

  const downloadMutation = useMutation({
    mutationFn: async () => {
      if (!documentId || !activeVersion) return;
      const targetFilename = activeVersion.filename || effectiveDocument?.title || "document";
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

  const uploadVersionMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!documentId) throw new Error("Document ID is required");
      return uploadDocumentVersionRequest(documentId, file);
    },
    onSuccess: (updatedDoc) => {
      queryClient.setQueryData([...DOCUMENT_QUERY_KEY, documentId], updatedDoc);
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
      void invalidateStorage(queryClient);

      const newVersion =
        updatedDoc.versions.find((v) => v.isCurrent) ??
        updatedDoc.versions.find((v) => v.versionNumber === updatedDoc.versionNumber) ??
        updatedDoc.versions[0];
      if (newVersion) {
        setSelectedVersionId(newVersion.id);
      }
    },
  });

  const uploadVersion = async (file: File): Promise<DocumentDetailView> => {
    return uploadVersionMutation.mutateAsync(file);
  };

  const previewError =
    previewQuery.error instanceof ApiError
      ? previewQuery.error
      : previewQuery.error
        ? new ApiError(500, "INTERNAL_ERROR", previewQuery.error.message)
        : null;

  return {
    document: effectiveDocument,
    activeVersion,
    activeVersionId,
    isLoading: documentQuery.isLoading,
    isError,
    error:
      effectiveError instanceof ApiError || effectiveError instanceof Error ? effectiveError : null,
    previewUrl: previewQuery.data?.url ?? null,
    isLoadingPreview: previewQuery.isLoading,
    previewError,
    isDownloading: downloadMutation.isPending,
    downloadError,
    selectVersion,
    handleDownload,
    uploadVersion,
  };
}
