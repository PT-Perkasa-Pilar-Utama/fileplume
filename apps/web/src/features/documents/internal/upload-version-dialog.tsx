import { ERROR_MESSAGES } from "@archiva/shared";
import { AlertCircle, Loader2, Upload, X } from "lucide-react";
import { type DragEvent, type JSX, useRef, useState } from "react";
import { Alert, AlertDescription } from "../../../components/ui/alert.tsx";
import { Button } from "../../../components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog.tsx";
import { ApiError } from "../../../lib/api.ts";
import { cn } from "../../../lib/cn.ts";
import { formatBytes } from "../../../lib/format.ts";
import { getAcceptedFileType, validateFile } from "../file-validation.ts";
import { FileTypeIcon } from "./file-type-icon.tsx";

export interface UploadVersionDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onUpload: (file: File) => Promise<unknown>;
  readonly isUploading?: boolean;
}

/**
 * Modal dialog for uploading a new document version (FE-S2-06, AC-21.01, AC-21.03).
 * Contains single file picker, save action, and in-place error rendering for identical content.
 */
export function UploadVersionDialog({
  open,
  onOpenChange,
  onUpload,
  isUploading = false,
}: UploadVersionDialogProps): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = isUploading || localSubmitting;

  const handleClose = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setSelectedFile(null);
      setErrorMessage(null);
      setIsDragOver(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
    onOpenChange(nextOpen);
  };

  const handleSelectFile = (file: File): void => {
    const check = validateFile(file);
    if (!check.valid) {
      setErrorMessage(check.error.message);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setErrorMessage(null);
  };

  const handleDragOver = (e: DragEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (busy) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleSelectFile(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      handleSelectFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!selectedFile || busy) return;

    const check = validateFile(selectedFile);
    if (!check.valid) {
      setErrorMessage(check.error.message);
      return;
    }

    setLocalSubmitting(true);
    setErrorMessage(null);

    try {
      await onUpload(selectedFile);
      // Succeeded: reset and close dialog (AC-21.01)
      setSelectedFile(null);
      setErrorMessage(null);
      onOpenChange(false);
    } catch (err) {
      // In-place refusal rendering without closing dialog (AC-21.03)
      if (err instanceof ApiError || err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(ERROR_MESSAGES.INTERNAL_ERROR);
      }
    } finally {
      setLocalSubmitting(false);
    }
  };

  const fileType = selectedFile ? getAcceptedFileType(selectedFile) : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Unggah Versi Baru</DialogTitle>
          <DialogDescription>
            Pilih file revisi untuk menambahkan versi baru ke dokumen ini. Sistem akan menetapkan
            nomor versi berikutnya.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.txt"
            onChange={handleInputChange}
            className="sr-only"
            disabled={busy}
            data-testid="upload-version-file-input"
          />

          {/* In-place error message (AC-21.03) */}
          {errorMessage && (
            <Alert variant="destructive" data-testid="upload-version-error">
              <AlertCircle className="size-4 shrink-0" />
              <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
            </Alert>
          )}

          {!selectedFile ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              data-testid="upload-version-dropzone"
              className={cn(
                "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
                isDragOver
                  ? "border-primary bg-primary/5 shadow-inner"
                  : "border-border hover:border-primary/50 hover:bg-muted/40",
                busy && "pointer-events-none opacity-50 cursor-not-allowed",
              )}
            >
              <Upload className="mb-2 size-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Klik untuk memilih file revisi atau seret ke sini
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Format: PDF, DOCX, XLSX, TXT (Maks. 20 MB)
              </p>
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileTypeIcon fileType={fileType ?? "other"} size="sm" />
                <div className="min-w-0 text-left">
                  <p
                    className="text-sm font-medium text-foreground truncate"
                    data-testid="upload-version-selected-filename"
                  >
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  setErrorMessage(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                disabled={busy}
                aria-label="Hapus file terpilih"
                className="h-8 w-8 p-0"
              >
                <X className="size-4" />
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={busy}
              data-testid="upload-version-cancel"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={!selectedFile || busy}
              data-testid="upload-version-submit"
            >
              {busy && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
