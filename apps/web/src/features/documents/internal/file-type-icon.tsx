import { FileCode, FileSpreadsheet, FileText, FileWarning } from "lucide-react";
import type { JSX } from "react";
import { cn } from "../../../lib/cn.ts";
import type { AcceptedFileType } from "../types.ts";

export interface FileTypeIconProps {
  readonly fileType: AcceptedFileType | "other" | "unsupported";
  readonly className?: string;
  readonly size?: "sm" | "md" | "lg";
}

export function FileTypeIcon({ fileType, className, size = "md" }: FileTypeIconProps): JSX.Element {
  const sizeClasses = {
    sm: "size-7 rounded p-1 text-xs",
    md: "size-10 rounded-[10px] p-2 text-sm",
    lg: "size-12 rounded-xl p-2.5 text-base",
  }[size];

  const iconSizes = {
    sm: "size-3.5",
    md: "size-5",
    lg: "size-6",
  }[size];

  switch (fileType) {
    case "pdf":
      return (
        <div
          role="img"
          data-testid="file-icon-pdf"
          className={cn(
            "flex shrink-0 items-center justify-center bg-alert-destructive-bg text-alert-destructive-text font-semibold",
            sizeClasses,
            className,
          )}
          aria-label="File PDF"
        >
          <FileText className={iconSizes} />
        </div>
      );
    case "docx":
      return (
        <div
          role="img"
          data-testid="file-icon-docx"
          className={cn(
            "flex shrink-0 items-center justify-center bg-primary/10 text-primary font-semibold",
            sizeClasses,
            className,
          )}
          aria-label="File DOCX"
        >
          <FileText className={iconSizes} />
        </div>
      );
    case "xlsx":
      return (
        <div
          role="img"
          data-testid="file-icon-xlsx"
          className={cn(
            "flex shrink-0 items-center justify-center bg-alert-success-bg text-alert-success-text font-semibold",
            sizeClasses,
            className,
          )}
          aria-label="File XLSX"
        >
          <FileSpreadsheet className={iconSizes} />
        </div>
      );
    case "txt":
      return (
        <div
          role="img"
          data-testid="file-icon-txt"
          className={cn(
            "flex shrink-0 items-center justify-center bg-muted text-muted-foreground font-semibold",
            sizeClasses,
            className,
          )}
          aria-label="File TXT"
        >
          <FileCode className={iconSizes} />
        </div>
      );
    default:
      return (
        <div
          role="img"
          data-testid="file-icon-unsupported"
          className={cn(
            "flex shrink-0 items-center justify-center bg-alert-warning-bg text-alert-warning-text font-semibold",
            sizeClasses,
            className,
          )}
          aria-label="File tidak didukung"
        >
          <FileWarning className={iconSizes} />
        </div>
      );
  }
}
