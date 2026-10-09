import { ERROR_MESSAGES, UPLOAD_MESSAGES } from "@archiva/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { type JSX, useEffect } from "react";
import { Badge } from "../../../components/ui/badge.tsx";
import { ApiError } from "../../../lib/api.ts";
import { cn } from "../../../lib/cn.ts";
import { formatBytes } from "../../../lib/format.ts";
import { fetchDocumentDetail } from "../detail-api.ts";
import { getAcceptedFileType } from "../file-validation.ts";
import type { TrayItem } from "../types.ts";
import { FileTypeIcon } from "./file-type-icon.tsx";

const PROCESSING_POLL_INTERVAL_MS = 2_000;
const PROCESSING_QUERY_RETRY_LIMIT = 3;
const DOCUMENT_PROCESSING_QUERY_KEY = ["document-processing"] as const;

export interface UploadFileItemProps {
  readonly item: TrayItem;
  readonly onDismiss?: (id: string) => void;
  readonly onMalwareDetected?: (id: string) => void;
}

export function UploadFileItem({
  item,
  onDismiss,
  onMalwareDetected,
}: UploadFileItemProps): JSX.Element {
  const detectedType = getAcceptedFileType(item.file) ?? "unsupported";
  const isUploading = item.status === "uploading";
  const isAccepted = item.status === "accepted";
  const documentId = item.document?.id;
  const processingQuery = useQuery({
    queryKey: [...DOCUMENT_PROCESSING_QUERY_KEY, documentId],
    queryFn: () => {
      if (!documentId) throw new Error("An accepted upload must have a document id");
      return fetchDocumentDetail(documentId);
    },
    enabled: isAccepted && Boolean(documentId),
    refetchInterval: (query) => {
      const processingState = query.state.data?.processingState;
      const notFound =
        query.state.error instanceof ApiError && query.state.error.code === "NOT_FOUND";
      if (notFound || processingState === "ready" || processingState === "failed") return false;
      return PROCESSING_POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      const notFound = error instanceof ApiError && error.code === "NOT_FOUND";
      return !notFound && failureCount < PROCESSING_QUERY_RETRY_LIMIT;
    },
  });
  const malwareDetected =
    isAccepted &&
    processingQuery.error instanceof ApiError &&
    processingQuery.error.code === "NOT_FOUND";
  const isRejected = item.status === "rejected" || malwareDetected;

  useEffect(() => {
    if (malwareDetected) onMalwareDetected?.(item.id);
  }, [item.id, malwareDetected, onMalwareDetected]);

  const loadedBytes = Math.round((item.sizeBytes * item.progress) / 100);

  return (
    <div
      data-testid={`upload-item-${item.id}`}
      className={cn(
        "relative flex min-h-14 items-center gap-2 rounded-2xl border bg-card p-2 shadow-2xs transition-colors",
        isRejected ? "border-alert-destructive-border" : "border-border",
      )}
    >
      <FileTypeIcon
        fileType={detectedType}
        size="md"
        className={cn(isRejected && "bg-alert-destructive-bg text-alert-destructive-text")}
      />

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground" title={item.filename}>
            {item.filename}
          </p>
          {onDismiss && !isUploading && (
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors -mr-0.5"
              aria-label={`Hapus ${item.filename}`}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Uploading progress state */}
        {isUploading && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{`Mengunggah - ${item.progress}%`}</span>
              <span>
                {formatBytes(loadedBytes)} / {formatBytes(item.sizeBytes)}
              </span>
            </div>
            <div
              className="h-1 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={item.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progres unggahan ${item.filename}`}
            >
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Accepted state */}
        {isAccepted && !malwareDetected && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="flex items-center gap-1 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5 shrink-0" />
              {UPLOAD_MESSAGES.FILE_ACCEPTED}
            </span>
            {item.document && (
              <Badge variant="secondary" className="h-5 px-1.5 text-2xs font-normal">
                {item.document.processingLabel}
              </Badge>
            )}
          </div>
        )}

        {/* Rejected state */}
        {isRejected && (
          <div className="space-y-0.5 pt-0.5">
            <div className="flex items-start gap-1 text-xs font-medium text-destructive">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <span>{malwareDetected ? ERROR_MESSAGES.MALWARE_DETECTED : item.error?.message}</span>
            </div>
            {item.error?.existingDocumentId && (
              <div className="pl-4.5">
                <Link
                  to="/documents/$id"
                  params={{ id: item.error.existingDocumentId }}
                  className="inline-flex items-center text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  Lihat dokumen
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
