import type { JSX, LabelHTMLAttributes } from "react";
import { cn } from "../../lib/cn.ts";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  htmlFor?: string;
}

export function Label({ className, htmlFor, ...props }: LabelProps): JSX.Element {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: reusable label primitive forwards htmlFor to caller
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}
