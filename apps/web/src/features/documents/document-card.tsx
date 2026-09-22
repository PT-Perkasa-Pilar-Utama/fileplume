import type { DocumentView } from "@archiva/shared";
import { Link } from "@tanstack/react-router";
import type { JSX } from "react";
import { Badge } from "../../components/ui/badge.tsx";
import { Card } from "../../components/ui/card.tsx";
import { cn } from "../../lib/cn.ts";
import { formatBytes, formatDocumentDate } from "../../lib/format.ts";
import { FileTypeIcon } from "./internal/file-type-icon.tsx";
import type { UploadedDocumentDisplay } from "./types.ts";

export type DocumentCardItem = DocumentView | UploadedDocumentDisplay;

export interface DocumentCardProps {
  readonly document: DocumentCardItem;
  readonly className?: string;
}

/**
 * Maps processing state to badge variant.
 * Labels are strictly rendered from document.processingLabel served by the API.
 */
function getProcessingBadgeVariant(
  state: DocumentCardItem["processingState"],
): "success" | "destructive" | "outline" | "secondary" {
  switch (state) {
    case "ready":
      return "success";
    case "failed":
      return "destructive";
    case "processing":
      return "outline";
    default:
      return "secondary";
  }
}

/**
 * Visual Document Card (US-38, AC-38.01, AC-38.02, AC-01.02)
 * Renders file-type icon, title, upload date, uploader name, and processing status.
 * Clicking navigates to /documents/$id.
 */
export function DocumentCard({ document, className }: DocumentCardProps): JSX.Element {
  const uploaderName = "uploader" in document ? document.uploader.name : document.uploaderName;
  const isInvalidDate =
    "uploaderName" in document &&
    document.createdAt &&
    Number.isNaN(new Date(document.createdAt).getTime());
  const formattedDate = isInvalidDate ? document.createdAt : formatDocumentDate(document.createdAt);
  const sizeFormatted =
    typeof document.sizeBytes === "number" ? formatBytes(document.sizeBytes) : null;
  const badgeVariant = getProcessingBadgeVariant(document.processingState);

  return (
    <Card
      data-testid={`document-card-${document.id}`}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 shadow-xs transition-all hover:border-primary/50 hover:shadow-sm focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
    >
      <div data-testid={`uploaded-doc-${document.id}`} className="contents">
        <Link
          to="/documents/$id"
          params={{ id: document.id }}
          className="flex flex-col gap-3 focus:outline-none"
          aria-label={`Buka detail dokumen ${document.title}`}
        >
          <div className="flex items-start justify-between gap-3">
            {/* AC-38.01: ikon tipe file */}
            <FileTypeIcon fileType={document.fileType} />

            {/* AC-38.01: status pemrosesan (label strictly from server) */}
            <Badge
              variant={badgeVariant}
              data-testid={`document-status-${document.id}`}
              className={cn(
                "shrink-0 font-medium",
                document.processingState === "processing" && "animate-pulse border-primary/40",
              )}
            >
              {document.processingLabel}
            </Badge>
          </div>

          {/* AC-38.01: judul dokumen */}
          <div className="flex flex-col gap-1.5">
            <h4
              data-testid={`document-title-${document.id}`}
              title={document.title}
              className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary"
            >
              {document.title}
            </h4>

            {/* AC-38.01: tanggal unggah & nama pengunggah & ukuran file */}
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
              {sizeFormatted ? <span>{sizeFormatted}</span> : null}
              <span
                data-testid={`document-uploader-${document.id}`}
                className="truncate max-w-[120px]"
                title={uploaderName}
              >
                {uploaderName}
              </span>
            </div>

            <div className="flex items-center text-xs text-muted-foreground">
              <span data-testid={`document-date-${document.id}`}>{formattedDate}</span>
            </div>
          </div>
        </Link>
      </div>
    </Card>
  );
}
