import type { JSX } from "react";
import { cn } from "../../../../lib/cn.ts";
import { Card } from "../../../ui/card.tsx";

interface StorageUsageProps {
  percent?: number;
  className?: string;
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

export function StorageUsage({ percent = 25, className }: StorageUsageProps): JSX.Element {
  // SCAFFOLD(FE-S2-02): placeholder percent until GET /storage wiring lands (api-specs/04-configuration.md 4.5).
  const clamped = clampPercent(percent);

  return (
    <Card className={cn("p-4 shadow-none", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm">Storage Usage</span>
        <span className="text-muted-foreground text-sm tabular-nums">{clamped}%</span>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label="Storage Usage"
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </Card>
  );
}
