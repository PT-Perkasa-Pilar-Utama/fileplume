import { ERROR_MESSAGES } from "@archiva/shared";
import { AlertCircle } from "lucide-react";
import type { JSX } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert.tsx";
import { cn } from "../../lib/cn.ts";
import { DocumentCard, type DocumentCardItem } from "./document-card.tsx";
import { DocumentEmptyState } from "./document-empty-state.tsx";
import { useDocuments } from "./use-documents.ts";

export interface DocumentCardGridViewProps {
  readonly documents: readonly DocumentCardItem[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly errorMessage?: string | null;
  readonly emptyMessage?: string | null;
  readonly className?: string;
}

export interface DocumentCardGridProps {
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
            className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-border bg-card p-4 shadow-xs animate-pulse min-h-[150px]"
          >
            <div className="size-11 rounded-[10px] bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-5 w-16 rounded-full bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" data-testid="documents-grid-error" className={className}>
        <AlertCircle className="size-4" />
        <AlertDescription>{errorMessage || ERROR_MESSAGES.INTERNAL_ERROR}</AlertDescription>
      </Alert>
    );
  }

  // AC-38.03: Dasbor tanpa dokumen
  if (documents.length === 0) {
    return <DocumentEmptyState message={emptyMessage} className={className} />;
  }

  // AC-38.01, AC-01.02: Grid kartu dokumen visual
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

/**
 * Responsive Document Card Grid Component (US-38)
 * Connected component bound to useDocuments().
 */
export function DocumentCardGrid({ className }: DocumentCardGridProps = {}): JSX.Element {
  const query = useDocuments();

  return (
    <DocumentCardGridView
      documents={query.data?.data ?? []}
      isLoading={query.isLoading}
      isError={query.isError}
      errorMessage={query.error?.message}
      emptyMessage={query.data?.meta?.message}
      className={className}
    />
  );
}
