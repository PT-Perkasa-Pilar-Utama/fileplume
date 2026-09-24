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
      <h3 className="text-base font-medium text-foreground">
        No Document Uploaded
        <span className="sr-only">Belum ada dokumen yang diunggah</span>
      </h3>
      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line text-center">
        {"Please upload document first.\nClick or Drag and Drop Document to the Upload Area."}
        <span data-testid="empty-state-message" className="sr-only">
          {displayMessage}
        </span>
      </p>
    </div>
  );
}
