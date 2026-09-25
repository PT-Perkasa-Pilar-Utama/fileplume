import { UPLOAD_MESSAGES } from "@archiva/shared";
import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import type { JSX } from "react";
import { Badge } from "../../../components/ui/badge.tsx";
import { cn } from "../../../lib/cn.ts";
import { formatBytes } from "../../../lib/format.ts";
import { getAcceptedFileType } from "../file-validation.ts";
import type { TrayItem } from "../types.ts";
import { FileTypeIcon } from "./file-type-icon.tsx";

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
      className={cn(
        "relative flex min-h-14 items-center gap-2 rounded-[18px] border bg-white p-2 shadow-2xs transition-colors dark:bg-card",
        isRejected
          ? "border-[#ffc9c9] bg-white dark:border-destructive/40 dark:bg-card"
          : "border-[#e2e8f0] dark:border-border",
      )}
    >
      <FileTypeIcon
        fileType={detectedType}
        size="md"
        className={cn(
          isRejected &&
            "bg-[#fef2f2] text-destructive dark:bg-destructive/15 dark:text-destructive",
        )}
      />

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground" title={item.filename}>
            {item.filename}
          </p>
          {onDismiss && !isUploading && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(item.id);
              }}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[#62748e] hover:bg-slate-100 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring dark:hover:bg-muted transition-colors -mr-0.5"
              aria-label={`Hapus ${item.filename}`}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Uploading progress state */}
        {isUploading && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-[#62748e] dark:text-muted-foreground">
              <span>{`Mengunggah - ${item.progress}%`}</span>
              <span>
                {formatBytes(loadedBytes)} / {formatBytes(item.sizeBytes)}
              </span>
            </div>
            <div
              className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-muted"
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
              <span>{item.error?.message}</span>
            </div>
            {item.error?.existingDocumentId && (
              <div className="pl-4.5">
                <Link
                  to="/documents/$id"
                  params={{ id: item.error.existingDocumentId }}
                  onClick={(e) => e.stopPropagation()}
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
