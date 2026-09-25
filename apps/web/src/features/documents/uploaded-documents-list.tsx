import { EMPTY_STATE } from "@archiva/shared";
import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import type { JSX } from "react";
import { Badge } from "../../components/ui/badge.tsx";
import { EmptyState } from "../../components/ui/empty-state.tsx";
import { cn } from "../../lib/cn.ts";
import { formatBytes } from "../../lib/format.ts";
import { FileTypeIcon } from "./internal/file-type-icon.tsx";
import type { UploadedDocumentDisplay } from "./types.ts";

export interface UploadedDocumentsListProps {
  readonly documents: readonly UploadedDocumentDisplay[];
  readonly className?: string;
}

export function UploadedDocumentsList({
  documents,
  className,
}: UploadedDocumentsListProps): JSX.Element {
  const hasDocuments = documents.length > 0;

  return (
    <section aria-labelledby="uploaded-document-heading" className={cn("space-y-3", className)}>
      <div>
        <h2
          id="uploaded-document-heading"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          UPLOADED DOCUMENT
        </h2>
        <p className="text-xs text-muted-foreground">
          Repositori file dan catatan yang diunggah untuk akses dan verifikasi cepat.
        </p>
      </div>

      {!hasDocuments ? (
        <EmptyState
          data-testid="no-document-uploaded"
          icon={FileText}
          title={EMPTY_STATE.NO_DOCUMENTS}
        />
      ) : (
        <div
          data-testid="uploaded-documents-grid"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {documents.map((doc) => (
            <Link
              key={doc.id}
              to="/documents/$id"
              params={{ id: doc.id }}
              data-testid={`uploaded-doc-${doc.id}`}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 shadow-xs hover:border-border/80 hover:bg-muted/30 transition-colors text-left"
            >
              <FileTypeIcon fileType={doc.fileType} size="md" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium text-foreground" title={doc.title}>
                  {doc.title}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatBytes(doc.sizeBytes)}</span>
                  <span>{doc.uploaderName}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-2xs text-muted-foreground">{doc.createdAt}</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-2xs font-normal">
                    {doc.processingLabel}
                  </Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
