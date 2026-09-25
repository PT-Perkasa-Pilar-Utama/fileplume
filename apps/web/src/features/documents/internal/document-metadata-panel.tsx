import type { DocumentDetailView, DocumentVersionView } from "@archiva/shared";
import type { JSX } from "react";
import { Badge } from "../../../components/ui/badge.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx";
import { formatBytes, formatDocumentDate } from "../../../lib/format.ts";
import { VersionPicker } from "./version-picker.tsx";

export interface DocumentMetadataPanelProps {
  readonly document: DocumentDetailView;
  readonly activeVersion: DocumentVersionView;
  readonly onSelectVersion: (version: DocumentVersionView) => void;
  readonly isVersionSwitching?: boolean;
}

/**
 * Metadata panel in document detail view (AC-38.02, AC-21.02).
 * Displays document properties and version selector aligned with Figma 28:3451.
 */
export function DocumentMetadataPanel({
  document,
  activeVersion,
  onSelectVersion,
  isVersionSwitching,
}: DocumentMetadataPanelProps): JSX.Element {
  // AC-04.02: author renders "Tidak diketahui" when extraction found none
  const authorDisplay = document.metadata?.author ?? "Tidak diketahui";

  return (
    <Card
      data-testid="document-metadata-region"
      className="shadow-xs rounded-xl border border-border bg-card"
    >
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-base font-medium tracking-wide uppercase text-foreground">
          METADATA
        </CardTitle>
        <CardDescription className="text-sm font-normal text-muted-foreground">
          Show your metadata of selected document
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-3">
        <div className="flex flex-col divide-y divide-border/50">
          <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
            <span className="text-sm font-normal text-muted-foreground shrink-0">Judul</span>
            <p
              className="text-sm font-medium text-foreground truncate max-w-[200px] text-right"
              data-testid="metadata-title"
              title={document.title}
            >
              {document.title}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-sm font-normal text-muted-foreground shrink-0">Kategori</span>
            <p
              className="text-sm font-medium text-foreground truncate max-w-[200px] text-right"
              data-testid="metadata-category"
            >
              {document.category?.name ?? "Tanpa Kategori"}
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 py-2.5">
            <span className="text-sm font-normal text-muted-foreground shrink-0 pt-0.5">Tag</span>
            <div className="flex flex-col items-end gap-1.5" data-testid="metadata-tags">
              {document.tags.length > 0 ? (
                document.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="info"
                    className="h-5 px-2 text-2xs font-medium uppercase tracking-wider"
                  >
                    {tag}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Tidak ada tag</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-sm font-normal text-muted-foreground shrink-0">Penulis</span>
            <p
              className="text-sm font-medium text-foreground truncate max-w-[200px] text-right"
              data-testid="metadata-author"
            >
              {authorDisplay}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-sm font-normal text-muted-foreground shrink-0">Pengunggah</span>
            <p
              className="text-sm font-medium text-foreground truncate max-w-[200px] text-right"
              data-testid="metadata-uploader"
            >
              {document.uploader.name}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-sm font-normal text-muted-foreground shrink-0">
              Tanggal Unggah
            </span>
            <p
              className="text-sm font-medium text-foreground text-right"
              data-testid="metadata-date"
            >
              {formatDocumentDate(document.createdAt)}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-sm font-normal text-muted-foreground shrink-0">Ukuran File</span>
            <p
              className="text-sm font-medium text-foreground text-right"
              data-testid="metadata-size"
            >
              {formatBytes(activeVersion.sizeBytes)}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-sm font-normal text-muted-foreground shrink-0">Version</span>
            <div>
              <VersionPicker
                versions={document.versions}
                activeVersionId={activeVersion.id}
                onSelectVersion={onSelectVersion}
                disabled={isVersionSwitching}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 py-2.5 last:pb-0">
            <span className="text-sm font-normal text-muted-foreground shrink-0">
              Status Pemrosesan
            </span>
            <div>
              <Badge variant="secondary" data-testid="metadata-status">
                {document.processingLabel}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
