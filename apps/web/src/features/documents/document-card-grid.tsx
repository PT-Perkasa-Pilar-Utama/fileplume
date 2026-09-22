import { AlertCircle } from "lucide-react";
import type { JSX } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert.tsx";
import { cn } from "../../lib/cn.ts";
import { DocumentCard, type DocumentCardItem } from "./document-card.tsx";
import { DocumentEmptyState } from "./document-empty-state.tsx";
import { useDocuments } from "./use-documents.ts";

export interface DocumentCardGridProps {
  readonly documents?: readonly DocumentCardItem[];
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly errorMessage?: string | null;
  readonly emptyMessage?: string | null;
  readonly className?: string;
}

interface DocumentCardGridViewProps {
  readonly documents: readonly DocumentCardItem[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly errorMessage?: string | null;
  readonly emptyMessage?: string | null;
  readonly className?: string;
}

/**
 * Presentational view for the document card grid.
 */
export function DocumentCardGridView({
  documents,
  isLoading,
  isError,
  errorMessage,
  emptyMessage,
  className,
}: DocumentCardGridViewProps): JSX.Element {
  if (isLoading) {
    return (
      <div
        data-testid="documents-grid-loading"
        className={cn(
          "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
          className,
        )}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholders
            key={`doc-skeleton-${i}`}
            data-testid="document-card-skeleton"
            className="flex flex-col justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm animate-pulse min-h-[120px]"
          >
            <div className="flex items-start justify-between">
              <div className="size-10 rounded-lg bg-muted" />
              <div className="h-5 w-16 rounded-md bg-muted" />
            </div>
            <div className="space-y-2 mt-2">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" data-testid="documents-grid-error" className={className}>
        <AlertCircle className="size-4" />
        <AlertDescription>{errorMessage || "Gagal memuat daftar dokumen"}</AlertDescription>
      </Alert>
    );
  }

  // AC-38.03: Dasbor tanpa dokumen
  if (documents.length === 0) {
    return <DocumentEmptyState message={emptyMessage} className={className} />;
  }

  // AC-38.01, AC-38.02, AC-01.02: Grid kartu dokumen visual
  return (
    <div
      data-testid="documents-grid"
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
        className,
      )}
    >
      {documents.map((doc) => (
        <DocumentCard key={doc.id} document={doc} />
      ))}
    </div>
  );
}

function DocumentCardGridConnected(props: DocumentCardGridProps): JSX.Element {
  const query = useDocuments();

  return (
    <DocumentCardGridView
      documents={query.data?.data ?? []}
      isLoading={query.isLoading}
      isError={query.isError}
      errorMessage={query.error?.message}
      emptyMessage={query.data?.meta?.message}
      className={props.className}
    />
  );
}

/**
 * Responsive Document Card Grid Component (US-38)
 * Connects to useDocuments when uncontrolled, or displays controlled props.
 */
export function DocumentCardGrid(props: DocumentCardGridProps = {}): JSX.Element {
  if (
    props.documents !== undefined ||
    props.isLoading !== undefined ||
    props.isError !== undefined
  ) {
    return (
      <DocumentCardGridView
        documents={props.documents ?? []}
        isLoading={props.isLoading ?? false}
        isError={props.isError ?? false}
        errorMessage={props.errorMessage}
        emptyMessage={props.emptyMessage}
        className={props.className}
      />
    );
  }

  return <DocumentCardGridConnected {...props} />;
}
