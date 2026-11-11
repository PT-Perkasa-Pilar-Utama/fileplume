import type { CategoryView } from "@archiva/shared";
import type { JSX } from "react";

export interface CategoryCardProps {
  readonly category: CategoryView;
}

export function CategoryCard({ category }: CategoryCardProps): JSX.Element {
  const statusLabel = category.downloadActive ? "Active" : "Inactive";

  return (
    <article
      data-testid={`category-card-${category.id}`}
      className="flex min-h-[86px] items-start gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-2xs"
    >
      <span
        role="img"
        aria-label={`Download permission ${category.name}: ${statusLabel}`}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          category.downloadActive ? "bg-primary" : "bg-muted-foreground/25"
        }`}
      >
        <span
          className={`inline-block size-4 rounded-full bg-white shadow-xs transition-transform ${
            category.downloadActive ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-tight text-foreground">
            {category.name}
          </h2>
          <span
            data-testid={`category-permission-status-${category.id}`}
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-2xs font-medium ${
              category.downloadActive
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          By toggling this switch, you agree to set this category to downloadable
        </p>
      </div>
    </article>
  );
}
