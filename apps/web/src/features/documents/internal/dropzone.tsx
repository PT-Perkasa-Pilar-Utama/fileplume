import { Upload } from "lucide-react";
import { type DragEvent, type JSX, type KeyboardEvent, useRef, useState } from "react";
import { cn } from "../../../lib/cn.ts";

export interface DropzoneProps {
  readonly onFilesSelected: (files: File[]) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

export function Dropzone({
  onFilesSelected,
  disabled = false,
  className,
}: DropzoneProps): JSX.Element {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleClick = (): void => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      onFilesSelected(files);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <section
      aria-label="Area Unggah Dokumen"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "group relative flex min-h-56 flex-1 flex-col rounded-xl border-2 border-dashed transition-all",
        isDragOver
          ? "border-primary bg-primary/5 shadow-inner"
          : "border-muted-foreground/40 bg-muted/40 hover:border-muted-foreground/70 hover:bg-muted/60 dark:border-muted-foreground/30 dark:bg-muted/20",
        disabled && "pointer-events-none opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        tabIndex={-1}
        accept=".pdf,.docx,.xlsx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
        onChange={handleInputChange}
        className="sr-only"
        aria-hidden="true"
        disabled={disabled}
        data-testid="upload-file-input"
      />

      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label="Area Unggah Dokumen. Klik atau seret file ke sini"
        className="flex w-full flex-1 flex-col items-center justify-center p-8 text-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
      >
        <div className="mb-3 text-foreground transition-transform group-hover:scale-105">
          <Upload className="size-6 stroke-[1.75]" />
        </div>

        <p className="mb-1 text-base font-normal text-foreground">
          Klik untuk mengunggah atau seret dan lepas file di sini
        </p>
        <p className="text-sm font-normal text-muted-foreground">(PDF, DOCX, XLSX, TXT)</p>
      </button>
    </section>
  );
}
