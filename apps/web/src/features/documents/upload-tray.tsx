import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { JSX } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert.tsx";
import { cn } from "../../lib/cn.ts";
import { DEFAULT_MAX_FILE_SIZE_MB } from "./file-validation.ts";
import { Dropzone } from "./internal/dropzone.tsx";
import { UploadFileItem } from "./internal/upload-file-item.tsx";
import { type UseUploadTrayOptions, useUploadTray } from "./internal/use-upload-tray.ts";

export interface UploadTrayProps extends UseUploadTrayOptions {
  readonly className?: string;
}

export function UploadTray({
  onUploadSettled,
  maxFileSizeMb = DEFAULT_MAX_FILE_SIZE_MB,
  initialItems = [],
  uploader,
  className,
}: UploadTrayProps): JSX.Element {
  const {
    items,
    isUploading,
    batchError,
    batchSummary,
    successMessage,
    handleFiles,
    handleDismiss,
  } = useUploadTray({
    onUploadSettled,
    maxFileSizeMb,
    initialItems,
    uploader,
  });

  return (
    <div
      data-testid="upload-tray"
      className={cn("rounded-xl border border-border bg-card p-6 shadow-xs space-y-4", className)}
    >
      <div className="flex flex-col space-y-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          AREA UNGGAH
        </h2>
        <p className="text-base font-semibold text-foreground">Unggah dokumen Anda di bawah ini</p>
      </div>

      {/* Batch-level refusal error (e.g. AC-01.05 > 20 files) */}
      {batchError && (
        <Alert variant="destructive" data-testid="batch-error-alert">
          <AlertCircle className="size-4" />
          <AlertDescription>{batchError}</AlertDescription>
        </Alert>
      )}

      {/* Mixed result batch summary banner (5.2 & AC-35.04) */}
      {batchSummary && (
        <Alert
          data-testid="batch-summary-alert"
          className="border-primary/20 bg-primary/5 text-foreground"
        >
          <Info className="size-4 text-primary" />
          <AlertDescription>{batchSummary}</AlertDescription>
        </Alert>
      )}

      {/* Success notification banner (AC-01.01, AC-01.04, AC-03.02) */}
      {successMessage && (
        <Alert variant="success" data-testid="upload-success-alert">
          <CheckCircle2 className="size-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <Dropzone onFilesSelected={handleFiles} disabled={isUploading} />
        </div>

        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center text-muted-foreground">
              <p className="text-sm font-medium">Belum ada file yang diunggah</p>
              <p className="text-xs mt-1">
                Pilih atau seret file ke area sebelah kiri untuk memulai unggahan.
              </p>
            </div>
          ) : (
            <div
              data-testid="upload-items-list"
              className="max-h-[380px] space-y-2.5 overflow-y-auto pr-1"
            >
              {items.map((item) => (
                <UploadFileItem key={item.id} item={item} onDismiss={handleDismiss} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
