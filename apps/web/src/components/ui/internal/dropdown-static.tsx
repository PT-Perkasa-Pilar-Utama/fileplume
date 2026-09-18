import type { HTMLAttributes, JSX } from "react";
import { cn } from "../../../lib/cn.ts";

export interface DropdownMenuLabelProps extends HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
}

export function DropdownMenuLabel({
  className,
  inset,
  ...props
}: DropdownMenuLabelProps): JSX.Element {
  return (
    <div
      className={cn("px-2 py-1.5 font-semibold text-sm", inset && "pl-8", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: HTMLAttributes<HTMLHRElement>): JSX.Element {
  return <hr className={cn("-mx-1 my-1 h-px border-0 bg-border", className)} {...props} />;
}

export function DropdownMenuGroup({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn(className)} {...props} />;
}
