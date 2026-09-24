import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, JSX, ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  variant?: "default" | "dashed" | "compact" | "borderless";
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  variant = "default",
  className,
  ...props
}: EmptyStateProps): JSX.Element {
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex h-32 items-center justify-center text-muted-foreground text-sm",
          className,
        )}
        {...props}
      >
        {description ?? title}
      </div>
    );
  }

  const isDashed = variant === "dashed";
  const isBorderless = variant === "borderless";
  const Icon = icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        isBorderless
          ? "p-6 bg-transparent"
          : isDashed
            ? "min-h-[220px] rounded-xl border border-dashed border-border bg-muted/40 p-6 text-muted-foreground"
            : "min-h-[160px] rounded-xl border border-border bg-card p-6 shadow-xs",
        className,
      )}
      {...props}
    >
      {Icon ? (
        <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      ) : null}
      <h3 className="font-medium text-base text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm font-normal text-muted-foreground whitespace-pre-line">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
