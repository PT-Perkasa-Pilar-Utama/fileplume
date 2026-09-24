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
 * Displays document properties and version selector.
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
    <Card data-testid="document-metadata-region" className="shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Metadata</CardTitle>
        <CardDescription className="text-xs">
          Informasi properti dan riwayat versi dokumen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Judul</span>
            <p
              className="text-sm font-medium text-foreground break-words"
              data-testid="metadata-title"
            >
              {document.title}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Kategori</span>
            <p className="text-sm text-foreground" data-testid="metadata-category">
              {document.category?.name ?? "Tanpa Kategori"}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Pengunggah</span>
            <p className="text-sm text-foreground" data-testid="metadata-uploader">
              {document.uploader.name}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Pembuat (Penulis)</span>
            <p className="text-sm text-foreground" data-testid="metadata-author">
              {authorDisplay}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Tanggal Unggah</span>
            <p className="text-sm text-foreground" data-testid="metadata-date">
              {formatDocumentDate(document.createdAt)}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Ukuran File</span>
            <p className="text-sm text-foreground" data-testid="metadata-size">
              {formatBytes(activeVersion.sizeBytes)}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Versi Aktif</span>
            <div className="pt-0.5">
              <VersionPicker
                versions={document.versions}
                activeVersionId={activeVersion.id}
                onSelectVersion={onSelectVersion}
                disabled={isVersionSwitching}
              />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Status Pemrosesan</span>
            <div className="pt-0.5">
              <Badge variant="secondary" data-testid="metadata-status">
                {document.processingLabel}
              </Badge>
            </div>
          </div>

          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-medium text-muted-foreground">Tag</span>
            <div className="flex flex-wrap gap-1.5 pt-0.5" data-testid="metadata-tags">
              {document.tags.length > 0 ? (
                document.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[11px] font-normal">
                    {tag}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Tidak ada tag</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
