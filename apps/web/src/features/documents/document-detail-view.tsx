import { EMPTY_STATE } from "@archiva/shared";
import { Link, useParams } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, FileX, Loader2 } from "lucide-react";
import type { JSX } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert.tsx";
import { buttonVariants } from "../../components/ui/button.tsx";
import { ApiError } from "../../lib/api.ts";
import { DocumentExtractedFieldsPanel } from "./internal/document-extracted-fields-panel.tsx";
import { DocumentMetadataPanel } from "./internal/document-metadata-panel.tsx";
import { DocumentPreviewPanel } from "./internal/document-preview-panel.tsx";
import { useDocumentDetail } from "./use-document-detail.ts";

export interface DocumentDetailViewProps {
  readonly documentId?: string;
}

/**
 * Document detail route shell (AC-38.02, AC-21.02).
 * Displays metadata region, extracted-fields region, and preview region
 * with version picker and download capabilities.
 */
export function DocumentDetailView({ documentId }: DocumentDetailViewProps = {}): JSX.Element {
  const params = useParams({ strict: false }) as { id?: string };
  const effectiveId = documentId ?? params.id ?? "";

  const {
    document,
    activeVersion,
    isLoading,
    isError,
    error,
    previewUrl,
    isLoadingPreview,
    previewError,
    isDownloading,
    downloadError,
    selectVersion,
    handleDownload,
  } = useDocumentDetail({ documentId: effectiveId });

  // Loading state
  if (isLoading) {
    return (
      <div
        data-testid="document-detail-loading"
        className="flex min-h-[400px] flex-col items-center justify-center space-y-3"
      >
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Memuat detail dokumen...</p>
      </div>
    );
  }

  // Not found or error state
  if (isError || !document || !activeVersion) {
    const isNotFound =
      !document ||
      (error instanceof ApiError && error.status === 404) ||
      error?.message === EMPTY_STATE.DOCUMENT_NOT_FOUND;

    return (
      <div
        data-testid="document-detail-error"
        className="flex min-h-[400px] flex-col items-center justify-center space-y-4 text-center p-6"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileX className="size-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            {isNotFound ? EMPTY_STATE.DOCUMENT_NOT_FOUND : "Gagal Memuat Dokumen"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {isNotFound
              ? "Dokumen yang Anda cari tidak ditemukan atau telah dihapus."
              : (error?.message ?? "Terjadi kesalahan saat memuat dokumen.")}
          </p>
        </div>
        <Link to="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft className="mr-1.5 size-4" />
          Kembali ke Dasbor
        </Link>
      </div>
    );
  }

  return (
    <div data-testid="document-detail-shell" className="space-y-4">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            to="/dashboard"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="size-3.5" />
            <span>Dasbor</span>
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate max-w-[240px] sm:max-w-md">
            {document.title}
          </span>
        </div>
      </div>

      {/* Download error alert */}
      {downloadError && (
        <Alert variant="destructive" data-testid="download-error-alert">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-xs">{downloadError}</AlertDescription>
        </Alert>
      )}

      {/* Document Detail 2-column grid: Preview + Metadata / Extracted Fields */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Preview Region (Left, 7 or 8 columns on large screens) */}
        <div className="lg:col-span-7 xl:col-span-8">
          <DocumentPreviewPanel
            document={document}
            activeVersion={activeVersion}
            previewUrl={previewUrl}
            isLoadingPreview={isLoadingPreview}
            previewError={previewError}
            isDownloading={isDownloading}
            onDownload={handleDownload}
          />
        </div>

        {/* Metadata & Extracted Fields Regions (Right, 5 or 4 columns) */}
        <div className="space-y-6 lg:col-span-5 xl:col-span-4">
          <DocumentMetadataPanel
            document={document}
            activeVersion={activeVersion}
            onSelectVersion={selectVersion}
            isVersionSwitching={isLoadingPreview}
          />

          <DocumentExtractedFieldsPanel document={document} />
        </div>
      </div>
    </div>
  );
}
