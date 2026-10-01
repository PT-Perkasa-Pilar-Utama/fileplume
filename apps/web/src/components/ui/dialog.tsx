import { X } from "lucide-react";
import {
  createContext,
  type HTMLAttributes,
  type JSX,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
} from "react";
import { cn } from "../../lib/cn.ts";

export interface DialogContextValue {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly titleId: string;
  readonly descriptionId: string;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within a Dialog");
  }
  return context;
}

export interface DialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps): JSX.Element {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <DialogContext.Provider value={{ open, onOpenChange, titleId, descriptionId }}>
      {children}
    </DialogContext.Provider>
  );
}

export interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  readonly showCloseButton?: boolean;
}

export function DialogContent({
  children,
  className,
  showCloseButton = true,
  ...props
}: DialogContentProps): JSX.Element | null {
  const { open, onOpenChange, titleId, descriptionId } = useDialog();
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    if (document.activeElement instanceof HTMLElement) {
      previousActiveElementRef.current = document.activeElement;
    }

    containerRef.current?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key === "Tab") {
        const container = containerRef.current;
        if (!container) return;

        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );

        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first || document.activeElement === container) {
            event.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElementRef.current?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay closes dialog on outside click
    <div
      role="presentation"
      data-testid="dialog-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in-0 duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-testid="dialog-container"
        className={cn(
          "relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg space-y-4 text-foreground outline-hidden animate-in zoom-in-95 duration-200",
          className,
        )}
        {...props}
      >
        {children}

        {showCloseButton && (
          <button
            type="button"
            data-testid="dialog-close-button"
            aria-label="Tutup"
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring cursor-pointer"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn("flex flex-col space-y-1.5", className)} {...props} />;
}

export function DialogTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  const { titleId } = useDialog();
  return (
    <h2
      id={titleId}
      className={cn("text-lg font-semibold leading-none tracking-tight text-foreground", className)}
      {...props}
    >
      {children}
    </h2>
  );
}

export function DialogDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  const { descriptionId } = useDialog();
  return (
    <p id={descriptionId} className={cn("text-sm text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2 pt-2", className)}
      {...props}
    />
  );
}
