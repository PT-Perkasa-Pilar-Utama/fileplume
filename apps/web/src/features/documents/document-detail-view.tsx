import { EMPTY_STATE, ERROR_MESSAGES } from "@archiva/shared";
import { Link, useParams } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, ChevronRight, FileX, Loader2 } from "lucide-react";
import { type JSX, useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert.tsx";
import { buttonVariants } from "../../components/ui/button.tsx";
import { EmptyState } from "../../components/ui/empty-state.tsx";
import { ApiError } from "../../lib/api.ts";
import { DocumentExtractedFieldsPanel } from "./internal/document-extracted-fields-panel.tsx";
import { DocumentMetadataPanel } from "./internal/document-metadata-panel.tsx";
import { DocumentPreviewPanel } from "./internal/document-preview-panel.tsx";
import { UploadVersionDialog } from "./internal/upload-version-dialog.tsx";
import { useDocumentDetail } from "./use-document-detail.ts";

export interface DocumentDetailViewProps {
  readonly documentId?: string;
  readonly maxFileSizeMb?: number;
}

/**
 * Document detail route shell (AC-38.02, AC-21.02).
 * Displays metadata region, extracted-fields region, and preview region
 * with version picker and download capabilities, aligned with Figma screen 28:3451.
 */
export function DocumentDetailView({
  documentId,
  maxFileSizeMb,
}: DocumentDetailViewProps = {}): JSX.Element {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const params = useParams({ strict: false });
  const paramId = "id" in params && typeof params.id === "string" ? params.id : "";
  const effectiveId = documentId ?? paramId;

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
    uploadVersion,
  } = useDocumentDetail({ documentId: effectiveId });

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

  if (isError || !document || !activeVersion) {
    const isNotFound = error instanceof ApiError && error.code === "NOT_FOUND";

    return (
      <div data-testid="document-detail-error" className="py-12">
        <EmptyState
          variant="borderless"
          icon={FileX}
          title={isNotFound ? EMPTY_STATE.DOCUMENT_NOT_FOUND : ERROR_MESSAGES.INTERNAL_ERROR}
          description={isNotFound ? undefined : error?.message}
          action={
            <Link to="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ArrowLeft className="mr-1.5 size-4" />
              Kembali ke Dasbor
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div data-testid="document-detail-shell" className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
          <Link
            to="/documents"
            className="text-muted-foreground hover:text-foreground transition-colors font-normal"
          >
            Dokumen
          </Link>
          <ChevronRight className="size-4 text-muted-foreground/60 shrink-0" />
          <span className="text-primary font-medium">Detail Dokumen</span>
        </nav>
      </div>

      {downloadError && (
        <Alert variant="destructive" data-testid="download-error-alert">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-xs">{downloadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <div className="space-y-6 lg:col-span-5 xl:col-span-4 order-2 lg:order-1">
          <DocumentMetadataPanel
            document={document}
            activeVersion={activeVersion}
            onSelectVersion={selectVersion}
            isVersionSwitching={isLoadingPreview}
            onUploadNewVersion={() => setIsUploadDialogOpen(true)}
          />

          <DocumentExtractedFieldsPanel document={document} />
        </div>

        <div className="lg:col-span-7 xl:col-span-8 order-1 lg:order-2">
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
      </div>

      <UploadVersionDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onUpload={uploadVersion}
        maxFileSizeMb={maxFileSizeMb}
      />
    </div>
  );
}
