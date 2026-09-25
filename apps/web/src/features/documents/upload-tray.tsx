import { AlertCircle, CheckCircle2, Info, Upload } from "lucide-react";
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
      className={cn(
        "rounded-[14px] border border-[#e2e8f0] bg-[#f1f5f9] p-6 shadow-xs space-y-4 dark:border-border dark:bg-card",
        className,
      )}
    >
      <div className="flex flex-col space-y-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-muted-foreground">
          AREA UNGGAH
        </h2>
        <p className="text-sm font-normal text-slate-500 dark:text-muted-foreground">
          Unggah dokumen Anda di bawah ini
        </p>
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

      <Dropzone onFilesSelected={handleFiles} disabled={isUploading}>
        {items.length > 0 &&
          (({ openFilePicker }) => (
            <div className="flex flex-col space-y-3 p-4">
              <div
                data-testid="upload-items-list"
                className="max-h-[380px] space-y-2 overflow-y-auto pr-1"
              >
                {items.map((item) => (
                  <UploadFileItem key={item.id} item={item} onDismiss={handleDismiss} />
                ))}
              </div>

              <div className="flex items-center justify-center pt-2 border-t border-slate-200/60 dark:border-border/60">
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={isUploading}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#62748e] hover:text-foreground transition-colors py-1.5 px-3 rounded-lg hover:bg-slate-200/50 dark:hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  <Upload className="size-3.5" />
                  <span>Tambah file lain</span>
                </button>
              </div>
            </div>
          ))}
      </Dropzone>
    </div>
  );
}
