import { EMPTY_STATE } from "@archiva/shared";
import { FileText } from "lucide-react";
import type { JSX } from "react";
import { Badge } from "../../components/ui/badge.tsx";
import { formatBytes } from "../../lib/format.ts";
import { FileTypeIcon } from "./internal/file-type-icon.tsx";
import type { UploadedDocumentDisplay } from "./types.ts";

export interface UploadedDocumentsListProps {
  readonly documents: readonly UploadedDocumentDisplay[];
}

export function UploadedDocumentsList({ documents }: UploadedDocumentsListProps): JSX.Element {
  const hasDocuments = documents.length > 0;

  return (
    <section aria-labelledby="uploaded-document-heading" className="space-y-3">
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
        <div
          data-testid="no-document-uploaded"
          className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-border bg-card p-6 text-center shadow-xs"
        >
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground">
            <FileText className="size-6 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">{EMPTY_STATE.NO_DOCUMENTS}</p>
        </div>
      ) : (
        <div
          data-testid="uploaded-documents-grid"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {documents.map((doc) => (
            <div
              key={doc.id}
              data-testid={`uploaded-doc-${doc.id}`}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 shadow-xs hover:border-border/80 transition-colors"
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
                  <span className="text-[11px] text-muted-foreground">{doc.createdAt}</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">
                    {doc.processingLabel}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
