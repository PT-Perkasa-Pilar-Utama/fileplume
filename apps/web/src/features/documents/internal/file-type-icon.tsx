import type { FileType } from "@archiva/shared";
import { FileCode, FileSpreadsheet, FileText, FileWarning, type LucideIcon } from "lucide-react";
import type { JSX } from "react";
import { cn } from "../../../lib/cn.ts";
import type { AcceptedFileType } from "../types.ts";

export interface FileTypeIconProps {
  readonly fileType: FileType | AcceptedFileType | "other" | "unsupported";
  readonly className?: string;
  readonly size?: "sm" | "md" | "lg";
}

interface VariantConfig {
  readonly icon: LucideIcon;
  readonly colorClasses: string;
  readonly label: string;
  readonly testId: string;
}

const FILE_TYPE_VARIANTS: Record<string, VariantConfig> = {
  pdf: {
    icon: FileText,
    colorClasses: "bg-alert-destructive-bg text-alert-destructive-text",
    label: "File PDF",
    testId: "file-icon-pdf",
  },
  docx: {
    icon: FileText,
    colorClasses: "bg-primary/10 text-primary",
    label: "File DOCX",
    testId: "file-icon-docx",
  },
  xlsx: {
    icon: FileSpreadsheet,
    colorClasses: "bg-alert-success-bg text-alert-success-text",
    label: "File XLSX",
    testId: "file-icon-xlsx",
  },
  txt: {
    icon: FileCode,
    colorClasses: "bg-muted text-muted-foreground",
    label: "File TXT",
    testId: "file-icon-txt",
  },
  unsupported: {
    icon: FileWarning,
    colorClasses: "bg-alert-warning-bg text-alert-warning-text",
    label: "File tidak didukung",
    testId: "file-icon-unsupported",
  },
};

const DEFAULT_VARIANT: VariantConfig = {
  icon: FileWarning,
  colorClasses: "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
  label: "File",
  testId: "file-icon-other",
};

const SIZE_CLASSES = {
  sm: "size-7 rounded p-1 text-xs",
  md: "size-10 rounded-lg p-2 text-sm",
  lg: "size-12 rounded-xl p-2.5 text-base",
} as const;

const ICON_SIZES = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-6",
} as const;

/**
 * Visual file-type icon mapping to Figma component document-icon (node 11:392)
 * for AC-38.01.
 */
export function FileTypeIcon({ fileType, className, size = "md" }: FileTypeIconProps): JSX.Element {
  const variant = FILE_TYPE_VARIANTS[fileType] ?? DEFAULT_VARIANT;
  const Icon = variant.icon;

  return (
    <div
      role="img"
      data-testid={variant.testId}
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold",
        variant.colorClasses,
        SIZE_CLASSES[size],
        className,
      )}
      aria-label={variant.label}
    >
      <Icon className={ICON_SIZES[size]} />
    </div>
  );
}
