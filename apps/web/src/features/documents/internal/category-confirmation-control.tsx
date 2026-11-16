import { type CategoryView, type DocumentView, ERROR_MESSAGES } from "@archiva/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { type JSX, useState } from "react";
import { Badge } from "../../../components/ui/badge.tsx";
import { Button } from "../../../components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu.tsx";
import { ApiError } from "../../../lib/api.ts";
import { cn } from "../../../lib/cn.ts";
import { confirmDocumentCategoryRequest, fetchAvailableCategories } from "../api.ts";
import { DOCUMENTS_QUERY_KEY } from "../use-documents.ts";

export interface CategoryConfirmationControlProps {
  readonly documentId: string;
  readonly category: NonNullable<DocumentView["category"]>;
  readonly onConfirmed?: (documentId: string) => void;
}

export const AVAILABLE_CATEGORIES_QUERY_KEY = ["available-categories"] as const;

export function getCategoryPillClasses(name: string): string {
  const normalized = name.toLowerCase().trim();
  if (normalized.includes("tech") || normalized.includes("spec")) {
    return "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300";
  }
  if (normalized.includes("agree") || normalized.includes("setuju")) {
    return "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (normalized.includes("require") || normalized.includes("butuh")) {
    return "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300";
  }
  if (normalized.includes("contract") || normalized.includes("kontrak")) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  }
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

/**
 * Category confirmation and picker control (AC-02.01, AC-02.02, AC-02.03, AC-02.04).
 * Preselects the suggested category prop and displays the suggestion badge.
 */
export function CategoryConfirmationControl({
  documentId,
  category,
  onConfirmed,
}: CategoryConfirmationControlProps): JSX.Element {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(
    null,
  );

  const categoriesQuery = useQuery<CategoryView[]>({
    queryKey: AVAILABLE_CATEGORIES_QUERY_KEY,
    queryFn: fetchAvailableCategories,
    staleTime: 60_000,
  });

  const availableCategories = categoriesQuery.data ?? [];
  const selectableCategories = availableCategories.filter((item) => !item.isSystem);
  const currentSelection = selectedCategory ?? { id: category.id, name: category.name };
  const displayName = currentSelection.name;

  const confirmMutation = useMutation({
    mutationFn: (catId: string) => confirmDocumentCategoryRequest(documentId, catId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
      onConfirmed?.(documentId);
    },
  });

  return (
    <div
      data-testid={`category-confirmation-${documentId}`}
      className="flex flex-col gap-2 pt-2 border-t border-border/40"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-1.5">
        <DropdownMenu className="min-w-0 flex-[1_1_9rem]">
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid={`category-picker-trigger-${documentId}`}
              aria-label={`Pilih kategori untuk dokumen. Kategori terpilih: ${displayName}`}
              title={displayName}
              className="inline-flex w-full min-w-0 items-center justify-between gap-1 text-xs font-normal text-foreground bg-slate-100/90 hover:bg-slate-200/90 dark:bg-muted dark:hover:bg-muted/80 px-2.5 py-1 rounded-full transition-colors truncate cursor-pointer"
            >
              <span className="truncate">{displayName}</span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground ml-1" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-56 p-2 rounded-2xl border border-border/80 bg-popover shadow-xl flex flex-col gap-1.5 z-50"
            data-testid={`category-picker-menu-${documentId}`}
          >
            {categoriesQuery.isPending && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">Memuat kategori...</p>
            )}
            {categoriesQuery.isError && (
              <p role="alert" className="px-2 py-1.5 text-xs text-destructive">
                {categoriesQuery.error instanceof ApiError
                  ? categoriesQuery.error.message
                  : ERROR_MESSAGES.INTERNAL_ERROR}
              </p>
            )}
            {!categoriesQuery.isPending &&
              !categoriesQuery.isError &&
              selectableCategories.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Tidak ada kategori</p>
              )}
            {selectableCategories.map((cat) => {
              const isSelected = cat.id === currentSelection.id;
              return (
                <DropdownMenuItem
                  key={cat.id}
                  data-testid={`category-option-${cat.id}`}
                  onClick={() => setSelectedCategory({ id: cat.id, name: cat.name })}
                  className="flex items-center justify-between p-1 rounded-lg hover:bg-accent/40 cursor-pointer"
                >
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      getCategoryPillClasses(cat.name),
                    )}
                  >
                    {cat.name}
                  </span>
                  {isSelected && (
                    <Check
                      className="size-4 text-foreground shrink-0 ml-auto"
                      data-testid={`category-selected-check-${cat.id}`}
                    />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {category.isSuggestion && (
          <Badge
            variant="outline"
            data-testid={`category-suggestion-badge-${documentId}`}
            title={`Saran: ${category.name}`}
            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-2xs px-2 py-0.5 font-medium shrink-0"
          >
            Saran
          </Badge>
        )}
      </div>

      <Button
        type="button"
        size="sm"
        data-testid={`confirm-category-btn-${documentId}`}
        disabled={confirmMutation.isPending}
        onClick={() => {
          confirmMutation.mutate(currentSelection.id);
        }}
        className="w-full h-7 text-xs font-medium"
      >
        {confirmMutation.isPending ? "Menyimpan..." : "Konfirmasi"}
      </Button>

      {confirmMutation.isError && (
        <p role="alert" className="text-2xs text-destructive">
          {confirmMutation.error instanceof ApiError
            ? confirmMutation.error.message
            : ERROR_MESSAGES.INTERNAL_ERROR}
        </p>
      )}
    </div>
  );
}
