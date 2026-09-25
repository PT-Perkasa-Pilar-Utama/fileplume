import { type DocumentDetailView, type DocumentVersionView, ERROR_MESSAGES } from "@archiva/shared";
import {
  AlertCircle,
  Download,
  Expand,
  Hand,
  Loader2,
  Printer,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { JSX } from "react";
import { Alert, AlertDescription } from "../../../components/ui/alert.tsx";
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

  const formattedPreviewUrl =
    previewUrl && !previewUrl.includes("#toolbar=0&navpanes=0")
      ? `${previewUrl}#toolbar=0&navpanes=0`
      : previewUrl;

  return (
    <Card
      data-testid="document-preview-region"
      className="flex flex-col shadow-xs rounded-xl border border-border bg-card"
    >
      {/* Figma Card Header: Title + Subtitle only (card-action is hidden in Figma 28:3451) */}
      <CardHeader className="p-6 pb-4">
        <div className="space-y-1 min-w-0">
          <CardTitle className="text-base font-medium tracking-wide uppercase text-foreground">
            DOCUMENT PREVIEW
          </CardTitle>
          <CardDescription className="text-sm font-normal text-muted-foreground truncate">
            Displays a live visual preview of the active document.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="p-6 pt-0 flex-1">
        {/* Figma Preview Container with Toolbar + Canvas */}
        <div
          data-testid="document-preview-viewer"
          className="rounded-lg border border-border overflow-hidden bg-card flex flex-col"
        >
          {/* Toolbar matching Figma screen 28:3451 */}
          <div className="bg-muted/60 border-b border-border p-3 sm:p-4 flex items-center justify-between gap-2 overflow-x-auto">
            {/* Left toolbar controls: Hand, Page Indicator, Zoom Out/In, Fullscreen */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="icon"
                type="button"
                className="h-8 w-8 rounded-lg bg-card text-foreground shadow-2xs hover:bg-muted"
                aria-label="Mode geser"
                title="Mode geser"
              >
                <Hand className="size-4" />
              </Button>
              <div
                className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground shadow-2xs"
                data-testid="preview-page-indicator"
              >
                <span>{`1 / ${totalPages}`}</span>
              </div>
              <Button
                variant="outline"
                size="icon"
                type="button"
                className="h-8 w-8 rounded-lg bg-card text-foreground shadow-2xs hover:bg-muted"
                aria-label="Perkecil pratinjau"
                title="Perkecil"
              >
                <ZoomOut className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                type="button"
                className="h-8 w-8 rounded-lg bg-card text-foreground shadow-2xs hover:bg-muted"
                aria-label="Perbesar pratinjau"
                title="Perbesar"
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                type="button"
                className="h-8 w-8 rounded-lg bg-card text-foreground shadow-2xs hover:bg-muted"
                aria-label="Layar penuh"
                title="Layar penuh"
              >
                <Expand className="size-4" />
              </Button>
            </div>

            {/* Right toolbar controls: Search, Print, Download */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="icon"
                type="button"
                className="h-8 w-8 rounded-lg bg-card text-foreground shadow-2xs hover:bg-muted"
                aria-label="Cari dalam dokumen"
                title="Cari"
              >
                <Search className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                type="button"
                className="h-8 w-8 rounded-lg bg-card text-foreground shadow-2xs hover:bg-muted"
                aria-label="Cetak dokumen"
                title="Cetak"
                onClick={() => {
                  if (typeof window !== "undefined") window.print();
                }}
              >
                <Printer className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                type="button"
                onClick={onDownload}
                disabled={isDownloading || !document.downloadAllowed}
                data-testid="download-button"
                className="h-8 w-8 rounded-lg bg-card text-foreground shadow-2xs hover:bg-muted"
                aria-label="Download"
                title="Download"
              >
                {isDownloading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
              </Button>
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

            {/* SCAFFOLD: FE-S4-03 replaces iframe preview with react-pdf canvas rendering every page with no local download */}
            {!isLoadingPreview && !previewError && formattedPreviewUrl && (
              <iframe
                src={formattedPreviewUrl}
                title={`Pratinjau ${document.title} - ${versionLabel}`}
                className="min-h-[540px] sm:min-h-[600px] w-full rounded-md border-0 bg-background shadow-lg"
                data-testid="preview-iframe"
              />
            )}

            {!isLoadingPreview && !previewError && !formattedPreviewUrl && (
              <div className="text-xs text-slate-300">Tidak ada konten pratinjau</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
