import {
  type ButtonHTMLAttributes,
  cloneElement,
  isValidElement,
  type JSX,
  type MouseEvent,
  type Ref,
} from "react";
import { cn } from "../../../lib/cn.ts";
import { useDropdownMenu } from "./dropdown-context.tsx";

interface TriggerChildProps {
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  ref?: Ref<HTMLButtonElement>;
  "aria-haspopup"?: "menu";
  "aria-expanded"?: boolean;
}

export interface DropdownMenuTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function DropdownMenuTrigger({
  asChild,
  children,
  onClick,
  className,
  ...props
}: DropdownMenuTriggerProps): JSX.Element {
  const { open, setOpen, triggerRef } = useDropdownMenu();

  const handleClick = (e: MouseEvent<HTMLButtonElement>): void => {
    onClick?.(e);
    if (!e.defaultPrevented) {
      setOpen(!open);
    }
  };

  if (asChild && isValidElement<TriggerChildProps>(children)) {
    const child = children;
    return cloneElement(child, {
      ref: triggerRef,
      onClick: (e: MouseEvent<HTMLButtonElement>) => {
        child.props.onClick?.(e);
        if (!e.defaultPrevented) {
          setOpen(!open);
        }
      },
      "aria-haspopup": "menu",
      "aria-expanded": open,
    });
  }

  return (
    <button
      type="button"
      ref={triggerRef}
      onClick={handleClick}
      aria-haspopup="menu"
      aria-expanded={open}
      className={cn(className)}
      {...props}
    >
      {children}
    </button>
  );
}
