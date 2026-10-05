import { describe, expect, test } from "bun:test";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog.tsx";

describe("Dialog component", () => {
  test("does not render content when closed", () => {
    const html = renderToString(
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogContent>
          <DialogTitle>Judul Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(html).not.toContain("Judul Dialog");
    expect(html).not.toContain('data-testid="dialog-container"');
  });

  test("renders content and accessibility attributes when open", () => {
    const html = renderToString(
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Judul Dialog</DialogTitle>
            <DialogDescription>Deskripsi dialog</DialogDescription>
          </DialogHeader>
          <div>Konten Utama</div>
          <DialogFooter>
            <button type="button">Aksi</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    expect(html).toContain("Judul Dialog");
    expect(html).toContain("Deskripsi dialog");
    expect(html).toContain("Konten Utama");
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('data-testid="dialog-overlay"');
    expect(html).toContain('data-testid="dialog-close-button"');
  });

  test("handles close trigger through button click in DOM", async () => {
    let closed = false;
    function TestWrapper() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog
          open={open}
          onOpenChange={(val) => {
            setOpen(val);
            if (!val) closed = true;
          }}
        >
          <DialogContent>
            <DialogTitle>Judul Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestWrapper />);
    });

    const closeButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="dialog-close-button"]',
    );
    expect(closeButton).not.toBeNull();

    await act(async () => {
      closeButton?.click();
    });

    expect(closed).toBe(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  test("moves focus into dialog on open and restores trigger focus on close", async () => {
    function TestWrapper() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" data-testid="trigger-btn" onClick={() => setOpen(true)}>
            Buka
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>Judul Dialog</DialogTitle>
              <button type="button" data-testid="inside-btn">
                Aksi Dalam
              </button>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestWrapper />);
    });

    const triggerBtn = container.querySelector<HTMLButtonElement>('[data-testid="trigger-btn"]');
    triggerBtn?.focus();
    expect(document.activeElement).toBe(triggerBtn);

    await act(async () => {
      triggerBtn?.click();
    });

    const dialogContainer = container.querySelector<HTMLDivElement>(
      '[data-testid="dialog-container"]',
    );
    expect(dialogContainer).not.toBeNull();
    expect(dialogContainer?.getAttribute("tabindex")).toBe("-1");

    const closeBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="dialog-close-button"]',
    );
    await act(async () => {
      closeBtn?.click();
    });

    expect(container.querySelector('[data-testid="dialog-container"]')).toBeNull();
    expect(document.activeElement).toBe(triggerBtn);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  test("does not steal focus or re-run effect when onOpenChange callback re-creates on render", async () => {
    function TestWrapper() {
      const [open, setOpen] = useState(true);
      const [count, setCount] = useState(0);

      const handleClose = (val: boolean) => setOpen(val);

      return (
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
            <button
              type="button"
              data-testid="increment-btn"
              onClick={() => setCount((c) => c + 1)}
            >
              Count: {count}
            </button>
          </DialogContent>
        </Dialog>
      );
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestWrapper />);
    });

    const incrementBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="increment-btn"]',
    );
    incrementBtn?.focus();
    expect(document.activeElement).toBe(incrementBtn);

    await act(async () => {
      incrementBtn?.click();
    });

    expect(document.activeElement).toBe(incrementBtn);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
