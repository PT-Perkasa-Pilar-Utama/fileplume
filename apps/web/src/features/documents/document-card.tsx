import type { DocumentView } from "@archiva/shared";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown } from "lucide-react";
import type { JSX } from "react";
import { Card } from "../../components/ui/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu.tsx";
import { cn } from "../../lib/cn.ts";
import { formatBytes, formatDocumentDate } from "../../lib/format.ts";
import { FileTypeIcon } from "./internal/file-type-icon.tsx";
import type { UploadedDocumentDisplay } from "./types.ts";

export type DocumentCardItem = DocumentView | UploadedDocumentDisplay;

export const DOCUMENT_CATEGORIES = [
  "Technicial Specs",
  "Agreement",
  "Requirement",
  "Contract",
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  "Technicial Specs": "text-blue-500",
  Agreement: "text-emerald-500",
  Requirement: "text-purple-500",
  Contract: "text-amber-500",
};

export interface DocumentCardProps {
  readonly document: DocumentCardItem;
  readonly category?: string;
  readonly onCategoryChange?: (id: string, category: string) => void;
  readonly className?: string;
}

function resolveCategoryName(document: DocumentCardItem, categoryOverride?: string): string {
  if (typeof categoryOverride === "string" && categoryOverride.length > 0) {
    return categoryOverride;
  }
  if ("category" in document && document.category && typeof document.category.name === "string") {
    return document.category.name;
  }
  return "Uncategorize";
}

/**
 * Visual Document Card (US-38, AC-38.01, AC-01.02, Figma 11:338)
 * Renders file-type icon, title, category dropdown pill, uploader name and upload date.
 * Clicking navigates to /documents/$id.
 */
export function DocumentCard({
  document,
  category,
  onCategoryChange,
  className,
}: DocumentCardProps): JSX.Element {
  const uploaderName = "uploader" in document ? document.uploader.name : document.uploaderName;
  const formattedDate = formatDocumentDate(document.createdAt);
  const sizeFormatted =
    typeof document.sizeBytes === "number" ? formatBytes(document.sizeBytes) : null;

  const currentCategory = resolveCategoryName(document, category);

  return (
    <Card
      data-testid={`document-card-${document.id}`}
      className={cn(
        "group relative flex flex-col items-center justify-between rounded-xl border border-border bg-card p-4 shadow-xs transition-all hover:border-primary/50 hover:shadow-sm focus-within:ring-2 focus-within:ring-ring text-center min-h-37.5",
        className,
      )}
    >
      <Link
        to="/documents/$id"
        params={{ id: document.id }}
        className="flex w-full flex-col items-center justify-center gap-2 focus:outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
        aria-label={`Buka detail dokumen ${document.title}`}
        title={sizeFormatted ? `${document.title} (${sizeFormatted})` : document.title}
      >
        {/* AC-38.01: ikon tipe file (Figma 13:586, 44x44px centered) */}
        <FileTypeIcon fileType={document.fileType} size="md" />

        {/* AC-38.01: judul dokumen (Figma 11:331, 14px font-medium, center, truncate) */}
        <h4
          data-testid={`document-title-${document.id}`}
          title={document.title}
          className="w-full truncate text-sm font-medium leading-tight text-foreground transition-colors group-hover:text-primary"
        >
          {document.title}
        </h4>
      </Link>

      {/* Figma 11:338: Category dropdown pill - OUTSIDE <Link>, with relative z-10 */}
      <div className="relative z-10 my-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Kategori dokumen: ${currentCategory}`}
              className="flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer border border-border/60"
            >
              <span className="truncate max-w-27.5">{currentCategory}</span>
              <ChevronDown className="size-3 shrink-0 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48 z-50">
            {DOCUMENT_CATEGORIES.map((cat) => {
              const isCurrent = currentCategory === cat;
              return (
                <DropdownMenuItem
                  key={cat}
                  onClick={() => onCategoryChange?.(document.id, isCurrent ? "Uncategorize" : cat)}
                  className="flex items-center justify-between text-xs cursor-pointer"
                >
                  <span className={CATEGORY_COLORS[cat] ?? ""}>{cat}</span>
                  {isCurrent && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* AC-38.01: Status pemrosesan (accessible for tests & screen readers) */}
      <span data-testid={`document-status-${document.id}`} className="sr-only">
        {document.processingLabel}
      </span>

      {/* AC-38.01 & AC-01.02: uploader • date (Figma 75:17791) */}
      <div className="relative z-10 flex items-center justify-center gap-1 text-2xs text-muted-foreground pointer-events-none">
        {uploaderName && <span>by</span>}
        <span
          data-testid={`document-uploader-${document.id}`}
          className="truncate max-w-21.25"
          title={uploaderName ?? undefined}
        >
          {uploaderName}
        </span>
        {uploaderName && <span aria-hidden="true">•</span>}
        <span data-testid={`document-date-${document.id}`} className="shrink-0">
          {formattedDate}
        </span>
        {sizeFormatted ? <span className="sr-only">{sizeFormatted}</span> : null}
      </div>
    </Card>
  );
}
