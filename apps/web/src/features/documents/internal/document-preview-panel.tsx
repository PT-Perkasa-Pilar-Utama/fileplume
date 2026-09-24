import { type DocumentDetailView, type DocumentVersionView, ERROR_MESSAGES } from "@archiva/shared";
import { AlertCircle, Download, FileText, Loader2 } from "lucide-react";
import type { JSX } from "react";
import { Alert, AlertDescription } from "../../../components/ui/alert.tsx";
import { Badge } from "../../../components/ui/badge.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Card, CardContent, CardHeader } from "../../../components/ui/card.tsx";
import type { ApiError } from "../../../lib/api.ts";

export interface DocumentPreviewPanelProps {
  readonly document: DocumentDetailView;
  readonly activeVersion: DocumentVersionView;
  readonly previewUrl: string | null;
  readonly isLoadingPreview: boolean;
  readonly previewError: ApiError | null;
  readonly isDownloading: boolean;
  readonly onDownload: () => void;
}

/**
 * Preview panel with viewer and download button (AC-38.02, AC-21.02).
 * Allows viewing PDF document preview and downloading the selected version.
 */
export function DocumentPreviewPanel({
  document,
  activeVersion,
  previewUrl,
  isLoadingPreview,
  previewError,
  isDownloading,
  onDownload,
}: DocumentPreviewPanelProps): JSX.Element {
  const versionLabel = `v${activeVersion.versionNumber}`;

  return (
    <Card data-testid="document-preview-region" className="flex flex-col shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border py-3 px-4">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="size-4 text-muted-foreground shrink-0" />
          <span className="truncate text-sm font-medium text-foreground">
            {activeVersion.filename || document.title}
          </span>
          <Badge
            variant="secondary"
            className="text-[11px] font-normal"
            data-testid="preview-version-badge"
          >
            {versionLabel}
          </Badge>
          {activeVersion.pageCount !== null && (
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {`${activeVersion.pageCount} Halaman`}
            </span>
          )}
        </div>

        {/* AC-21.02: Tombol "Download" mengunduh file versi aktif */}
        <Button
          type="button"
          size="sm"
          onClick={onDownload}
          disabled={isDownloading || !document.downloadAllowed}
          data-testid="download-button"
          className="gap-1.5 text-xs h-8"
        >
          {isDownloading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          <span>Download</span>
        </Button>
      </CardHeader>

      <CardContent className="p-4 flex-1">
        <div
          data-testid="document-preview-viewer"
          className="relative min-h-[500px] w-full flex items-center justify-center rounded-lg border border-border bg-muted/10 overflow-hidden"
        >
          {isLoadingPreview && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs">Memuat pratinjau...</span>
            </div>
          )}

          {!isLoadingPreview && previewError && (
            <div className="p-6 max-w-md w-full">
              <Alert variant="warning" data-testid="preview-error-alert">
                <AlertCircle className="size-4" />
                <AlertDescription className="text-xs">
                  {previewError.code === "PREVIEW_UNAVAILABLE"
                    ? ERROR_MESSAGES.PREVIEW_UNAVAILABLE
                    : previewError.message}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {!isLoadingPreview && !previewError && previewUrl && (
            <iframe
              src={previewUrl}
              title={`Pratinjau ${document.title} - ${versionLabel}`}
              className="h-[600px] w-full rounded-md border-0"
              data-testid="preview-iframe"
            />
          )}

          {!isLoadingPreview && !previewError && !previewUrl && (
            <div className="text-xs text-muted-foreground">Tidak ada konten pratinjau</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
