import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, JSX, MouseEvent } from "react";
import { cn } from "../../../lib/cn.ts";
import { useDropdownMenu } from "./dropdown-context.tsx";

const itemVariants = cva(
  "flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
        destructive:
          "text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface DropdownMenuItemProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof itemVariants> {}

export function DropdownMenuItem({
  children,
  className,
  variant,
  onClick,
  disabled,
  ...props
}: DropdownMenuItemProps): JSX.Element {
  const { setOpen, triggerRef } = useDropdownMenu();

  const handleClick = (e: MouseEvent<HTMLButtonElement>): void => {
    if (disabled) return;
    onClick?.(e);
    if (!e.defaultPrevented) {
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      className={cn(itemVariants({ variant, className }))}
      {...props}
    >
      {children}
    </button>
  );
}
