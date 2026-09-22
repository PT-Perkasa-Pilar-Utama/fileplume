import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { JSX } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert.tsx";
import { Dropzone } from "./internal/dropzone.tsx";
import { DEFAULT_MAX_FILE_SIZE_MB } from "./internal/file-validation.ts";
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
      className={`rounded-xl border border-border bg-card p-6 shadow-xs space-y-4 ${className ?? ""}`}
    >
      <div className="flex flex-col space-y-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          UPLOAD AREA
        </h2>
        <p className="text-base font-semibold text-foreground">Upload your document below</p>
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
          className="border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Info className="size-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription>{batchSummary}</AlertDescription>
        </Alert>
      )}

      {/* Success notification banner (AC-01.01, AC-01.04, AC-03.02) */}
      {successMessage && (
        <Alert
          data-testid="upload-success-alert"
          className="border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <Dropzone onFilesSelected={handleFiles} disabled={isUploading} />
        </div>

        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-slate-50/40 dark:bg-slate-900/20 p-6 text-center text-muted-foreground">
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
