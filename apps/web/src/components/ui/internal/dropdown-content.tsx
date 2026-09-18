import { type HTMLAttributes, type JSX, useEffect } from "react";
import { cn } from "../../../lib/cn.ts";
import { useDropdownMenu } from "./dropdown-context.tsx";

export interface DropdownMenuContentProps extends HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
}

export function DropdownMenuContent({
  children,
  className,
  align = "end",
  ...props
}: DropdownMenuContentProps): JSX.Element | null {
  const { open, setOpen, triggerRef, contentRef } = useDropdownMenu();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: globalThis.MouseEvent): void => {
      const target = e.target;
      if (!(target instanceof Node)) return;

      const inContent = contentRef.current?.contains(target);
      const inTrigger = triggerRef.current?.contains(target);
      if (!inContent && !inTrigger) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: globalThis.KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const container = contentRef.current;
        if (!container) return;
        const items = Array.from(
          container.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'),
        );
        if (items.length === 0) return;

        const activeElement = document.activeElement;
        const activeIndex =
          activeElement instanceof HTMLElement ? items.indexOf(activeElement) : -1;

        if (e.key === "ArrowDown") {
          const nextIndex =
            activeIndex === -1 || activeIndex === items.length - 1 ? 0 : activeIndex + 1;
          const targetItem = items[nextIndex];
          targetItem?.focus();
        } else {
          const prevIndex =
            activeIndex === -1 || activeIndex === 0 ? items.length - 1 : activeIndex - 1;
          const targetItem = items[prevIndex];
          targetItem?.focus();
        }
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setOpen, triggerRef, contentRef]);

  if (!open) return null;

  const alignClass =
    align === "start" ? "left-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "right-0";

  return (
    <div
      ref={contentRef}
      role="menu"
      tabIndex={-1}
      className={cn(
        "absolute z-50 mt-2 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 focus:outline-none",
        alignClass,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
