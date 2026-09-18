import type { JSX, ReactNode, RefObject } from "react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { cn } from "../../../lib/cn.ts";

export interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

export function useDropdownMenu(): DropdownMenuContextValue {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("useDropdownMenu must be used within DropdownMenu");
  }
  return context;
}

export interface DropdownMenuProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function DropdownMenu({
  children,
  open: controlledOpen,
  onOpenChange,
  className,
}: DropdownMenuProps): JSX.Element {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div className={cn("relative inline-block", className)}>{children}</div>
    </DropdownMenuContext.Provider>
  );
}
