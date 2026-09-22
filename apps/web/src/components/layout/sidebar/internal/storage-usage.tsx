import type { StorageLevel, StorageView } from "@archiva/shared";
import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";
import { cn } from "../../../../lib/cn.ts";
import { Card } from "../../../ui/card.tsx";

export interface StorageUsageProps {
  storage?: StorageView | null;
  state?: "loading" | "error" | "ready";
  className?: string;
}

/**
 * Progress bar color is driven strictly by the server's `level` field rather
 * than a client threshold, to avoid drifting from server upload refusals (api-specs/04-configuration.md 4.5).
 */
const LEVEL_PROGRESS_COLORS: Record<StorageLevel, string> = {
  ok: "bg-primary",
  warning: "bg-amber-500", // AC-35.02: kuning atau oranye (warning)
  full: "bg-destructive",
};

export function StorageUsage({
  storage,
  state = "ready",
  className,
}: StorageUsageProps): JSX.Element {
  if (state === "loading") {
    return (
      <Card className={cn("p-4 shadow-none", className)}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground text-sm leading-5">Storage Usage</span>
          <span className="h-4 w-8 animate-pulse rounded bg-muted" aria-hidden="true" />
        </div>
        <div
          className="mt-3 h-1 w-full animate-pulse overflow-hidden rounded-full bg-muted"
          role="status"
          aria-label="Memuat kapasitas penyimpanan"
        />
      </Card>
    );
  }

  if (state === "error" || !storage) {
    return (
      <Card className={cn("p-4 shadow-none", className)}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground text-sm leading-5">Storage Usage</span>
          <span className="text-muted-foreground text-xs leading-5">Tidak tersedia</span>
        </div>
        <div
          className="mt-3 h-1 w-full rounded-full bg-muted"
          role="status"
          aria-label="Kapasitas penyimpanan tidak tersedia"
        />
      </Card>
    );
  }

  const { percent, level, message } = storage;
  // Visual width clamped to prevent bar overflow while preserving exact percentage in label (api-specs/04-configuration.md 4.5)
  const barWidth = Math.min(Math.max(percent, 0), 100);

  return (
    <Card className={cn("p-4 shadow-none", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground text-sm leading-5">Storage Usage</span>
        <span className="font-normal text-muted-foreground text-sm leading-5 tabular-nums">
          {percent}%
        </span>
      </div>
      <div
        className="mt-3 h-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Storage Usage"
        data-level={level}
      >
        <div
          className={cn("h-full rounded-full transition-all", LEVEL_PROGRESS_COLORS[level])}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      {message ? (
        <div
          role="alert"
          className={cn(
            "mt-3 flex items-start gap-2 rounded-md border p-2.5 text-xs leading-relaxed",
            level === "warning" &&
              "border-amber-500/50 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200",
            level === "full" &&
              "border-alert-destructive-border bg-alert-destructive-bg text-alert-destructive-text",
          )}
        >
          <AlertTriangle
            className={cn(
              "mt-0.5 size-3.5 shrink-0",
              level === "warning" && "text-amber-600 dark:text-amber-400",
              level === "full" && "text-alert-destructive-text",
            )}
          />
          <span className="font-medium">{message}</span>
        </div>
      ) : null}
    </Card>
  );
}
