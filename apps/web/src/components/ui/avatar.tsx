import type { HTMLAttributes, ImgHTMLAttributes, JSX } from "react";
import { cn } from "../../lib/cn.ts";

export function Avatar({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn("relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}

export function AvatarImage({
  className,
  alt = "",
  ...props
}: ImgHTMLAttributes<HTMLImageElement>): JSX.Element {
  return (
    <img
      className={cn("aspect-square h-full w-full object-cover", className)}
      alt={alt}
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted font-medium text-xs text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}
