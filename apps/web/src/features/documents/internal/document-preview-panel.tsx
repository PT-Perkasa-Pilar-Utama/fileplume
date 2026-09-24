import { type DocumentDetailView, type DocumentVersionView, ERROR_MESSAGES } from "@archiva/shared";
import { AlertCircle, Download, FileText, Loader2 } from "lucide-react";
import type { JSX } from "react";
import { Alert, AlertDescription } from "../../../components/ui/alert.tsx";
import { Badge } from "../../../components/ui/badge.tsx";
import { Button } from "../../../components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx";
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
 * Styled after Figma screen 28:3451 with exact toolbar and dark canvas.
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
  const totalPages = activeVersion.pageCount ?? 1;

  return (
    <Card
      data-testid="document-preview-region"
      className="flex flex-col shadow-xs rounded-xl border border-border bg-card"
    >
      {/* Figma Card Header: Title + Subtitle on Left, Download Button on Right */}
      <CardHeader className="p-6 pb-4 flex flex-row items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <CardTitle className="text-base font-medium tracking-wide uppercase text-foreground">
            DOCUMENT PREVIEW
          </CardTitle>
          <CardDescription className="text-sm font-normal text-muted-foreground truncate">
            Displays a live visual preview of the active document.
          </CardDescription>
        </div>

        {/* AC-21.02: Tombol "Download" mengunduh file versi aktif */}
        <Button
          type="button"
          size="sm"
          onClick={onDownload}
          disabled={isDownloading || !document.downloadAllowed}
          data-testid="download-button"
          className="h-8 gap-1.5 px-3 text-xs font-medium shrink-0"
        >
          {isDownloading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          <span>Download</span>
        </Button>
      </CardHeader>

      <CardContent className="p-6 pt-0 flex-1">
        {/* Figma Preview Container with Toolbar + Canvas */}
        <div
          data-testid="document-preview-viewer"
          className="rounded-lg border border-border overflow-hidden bg-card flex flex-col"
        >
          {/* Toolbar */}
          <div className="bg-muted/80 border-b border-border px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <span className="truncate text-sm font-medium text-foreground max-w-[180px] sm:max-w-md">
                {activeVersion.filename || document.title}
              </span>
              <Badge
                variant="secondary"
                className="h-5 px-2 text-2xs font-normal shrink-0"
                data-testid="preview-version-badge"
              >
                {versionLabel}
              </Badge>
            </div>

            {/* Page Count Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground shadow-2xs">
                <span>{`1 / ${totalPages}`}</span>
              </div>
              {activeVersion.pageCount !== null && (
                <span className="hidden sm:inline text-xs text-muted-foreground">
                  {`${activeVersion.pageCount} Halaman`}
                </span>
              )}
            </div>
          </div>

          {/* Canvas (Slate background matching Figma rgba(49,65,88,1.00)) */}
          <div className="bg-[#314158] dark:bg-slate-900 p-4 sm:p-6 min-h-[580px] sm:min-h-[640px] flex items-center justify-center">
            {isLoadingPreview && (
              <div className="flex flex-col items-center gap-2 text-slate-200">
                <Loader2 className="size-7 animate-spin text-primary" />
                <span className="text-xs">Memuat pratinjau...</span>
              </div>
            )}

            {!isLoadingPreview && previewError && (
              <div className="p-4 max-w-md w-full">
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
                className="min-h-[540px] sm:min-h-[600px] w-full rounded-md border-0 bg-background shadow-lg"
                data-testid="preview-iframe"
              />
            )}

            {!isLoadingPreview && !previewError && !previewUrl && (
              <div className="text-xs text-slate-300">Tidak ada konten pratinjau</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
