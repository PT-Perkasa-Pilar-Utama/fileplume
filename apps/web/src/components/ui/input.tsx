import type { ComponentProps, JSX } from "react";
import { cn } from "../../lib/cn.ts";

export function Input({ className, type, ...props }: ComponentProps<"input">): JSX.Element {
  return (
    <input
      type={type}
      className={cn(
        "flex h-control w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
