import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import type { JSX } from "react";
import { Badge } from "../../../components/ui/badge.tsx";
import { formatBytes } from "../../../lib/format.ts";
import type { TrayItem } from "../types.ts";
import { FileTypeIcon } from "./file-type-icon.tsx";
import { getAcceptedFileType } from "./file-validation.ts";

export interface UploadFileItemProps {
  readonly item: TrayItem;
  readonly onDismiss?: (id: string) => void;
}

export function UploadFileItem({ item, onDismiss }: UploadFileItemProps): JSX.Element {
  const detectedType = getAcceptedFileType(item.file) ?? "other";

  const isUploading = item.status === "uploading";
  const isAccepted = item.status === "accepted";
  const isRejected = item.status === "rejected";

  const loadedBytes = Math.round((item.sizeBytes * item.progress) / 100);

  return (
    <div
      data-testid={`upload-item-${item.id}`}
      className="relative flex items-start gap-3 rounded-lg border border-border bg-card p-3 shadow-xs transition-colors"
    >
      <FileTypeIcon fileType={detectedType} size="md" />

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground" title={item.filename}>
            {item.filename}
          </p>
          {onDismiss && !isUploading && (
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="text-muted-foreground hover:text-foreground -mr-1 -mt-1 p-1 rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
              className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
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
        {isAccepted && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5 shrink-0" />
              File diterima untuk diproses
            </span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">
              {item.document?.processingLabel ?? "Diproses"}
            </Badge>
          </div>
        )}

        {/* Rejected state */}
        {isRejected && (
          <div className="space-y-1 pt-0.5">
            <div className="flex items-start gap-1 text-xs font-medium text-destructive">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <span>{item.error?.message}</span>
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
