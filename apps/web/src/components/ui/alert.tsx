import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, JSX } from "react";
import { cn } from "../../lib/cn.ts";

export const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        warning:
          "border-amber-500/50 text-amber-900 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-700 [&>svg]:text-amber-600",
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
    <h5
      className={cn("mb-1 font-medium leading-none tracking-tight col-start-2", className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  return <div className={cn("text-sm col-start-2 [&_p]:leading-relaxed", className)} {...props} />;
}
