import { EMPTY_STATE } from "@archiva/shared";
import { FileText } from "lucide-react";
import type { JSX } from "react";
import { cn } from "../../lib/cn.ts";

export interface DocumentEmptyStateProps {
  readonly message?: string | null;
  readonly className?: string;
}

/**
 * Empty state component for document collections (AC-38.03).
 * Renders the server-supplied message or falls back to EMPTY_STATE.NO_DOCUMENTS.
 */
export function DocumentEmptyState({ message, className }: DocumentEmptyStateProps): JSX.Element {
  const displayMessage = message || EMPTY_STATE.NO_DOCUMENTS;

  return (
    <div
      data-testid="no-document-uploaded"
      className={cn(
        "flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-border bg-card p-6 text-center shadow-xs",
        className,
      )}
    >
      <div
        data-testid="documents-empty-state"
        className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground"
      >
        <FileText className="size-6 text-slate-400 dark:text-slate-500" />
      </div>
      <p data-testid="empty-state-message" className="mt-1 max-w-sm text-xs text-muted-foreground">
        {displayMessage}
      </p>
    </div>
  );
}
