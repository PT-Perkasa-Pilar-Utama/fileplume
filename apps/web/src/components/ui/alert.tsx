import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, JSX } from "react";
import { cn } from "../../lib/cn.ts";

export const alertVariants = cva(
  "relative flex w-full items-center gap-2 rounded-[10px] border p-3 text-sm [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-border bg-background text-foreground",
        destructive:
          "border-alert-destructive-border bg-alert-destructive-bg text-alert-destructive-text [&>svg]:text-alert-destructive-text",
        warning:
          "border-amber-500/50 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200 [&>svg]:text-amber-600",
        success:
          "border-alert-success-border bg-alert-success-bg text-alert-success-text [&>svg]:text-alert-success-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps): JSX.Element {
  return <div role="alert" className={cn(alertVariants({ variant, className }))} {...props} />;
}

export function AlertTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  return (
    <h5 className={cn("font-medium text-sm leading-5 tracking-tight", className)} {...props} />
  );
}

export function AlertDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  return <div className={cn("font-medium text-sm leading-5", className)} {...props} />;
}
