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
});
