import { EMPTY_STATE } from "@archiva/shared";
import { FolderX } from "lucide-react";
import type { JSX } from "react";
import { cn } from "../../lib/cn.ts";

export interface DocumentEmptyStateProps {
  readonly message?: string | null;
  readonly className?: string;
}

/**
 * Empty state component for document collections (AC-38.03, Figma 1:1040).
 * Renders the server-supplied message or falls back to EMPTY_STATE.NO_DOCUMENTS.
 */
export function DocumentEmptyState({ message, className }: DocumentEmptyStateProps): JSX.Element {
  const displayMessage = message || EMPTY_STATE.NO_DOCUMENTS;

  return (
    <div
      data-testid="no-document-uploaded"
      className={cn(
        "flex flex-1 min-h-55 flex-col items-center justify-center p-8 text-center",
        className,
      )}
    >
      <div
        data-testid="documents-empty-state"
        className="mb-3.5 flex size-11 items-center justify-center rounded-[10px] bg-muted text-muted-foreground"
      >
        <FolderX className="size-6 stroke-[1.75]" />
      </div>
      <p
        data-testid="empty-state-message"
        className="mt-1 text-sm font-medium text-foreground text-center"
      >
        {displayMessage}
      </p>
    </div>
  );
}
