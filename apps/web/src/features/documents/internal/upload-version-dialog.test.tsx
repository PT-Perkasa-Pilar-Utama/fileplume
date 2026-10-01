import { describe, expect, mock, test } from "bun:test";
import { ERROR_MESSAGES } from "@archiva/shared";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { ApiError } from "../../../lib/api.ts";
import { UploadVersionDialog } from "./upload-version-dialog.tsx";

describe("UploadVersionDialog (FE-S2-06)", () => {
  test("does not render when closed", () => {
    const html = renderToString(
      <UploadVersionDialog open={false} onOpenChange={() => {}} onUpload={async () => {}} />,
    );

    expect(html).not.toContain("Unggah Versi Baru");
    expect(html).not.toContain('data-testid="upload-version-dropzone"');
  });

  test("renders title, description, dropzone, and action buttons when open", () => {
    const html = renderToString(
      <UploadVersionDialog open={true} onOpenChange={() => {}} onUpload={async () => {}} />,
    );

    expect(html).toContain("Unggah Versi Baru");
    expect(html).toContain("Pilih file revisi");
    expect(html).toContain('data-testid="upload-version-dropzone"');
    expect(html).toContain('data-testid="upload-version-submit"');
    expect(html).toContain('data-testid="upload-version-cancel"');
    expect(html).toContain("Simpan");
    expect(html).toContain("Batal");
  });

  // AC-21.01: Mengunggah versi baru melalui aksi eksplisit
  test("AC-21.01: selects revision file, enables submit, calls onUpload, and closes dialog on success", async () => {
    let isOpen = true;
    const handleOpenChange = (open: boolean) => {
      isOpen = open;
    };
    const onUploadMock = mock(async (_file: File) => {});

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function TestHost() {
      const [open, setOpen] = useState(true);
      return (
        <UploadVersionDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            handleOpenChange(next);
          }}
          onUpload={onUploadMock}
        />
      );
    }

    await act(async () => {
      root.render(<TestHost />);
    });

    const fileInput = container.querySelector<HTMLInputElement>(
      '[data-testid="upload-version-file-input"]',
    );
    const submitButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="upload-version-submit"]',
    );

    expect(fileInput).not.toBeNull();
    expect(submitButton).not.toBeNull();
    // Submit disabled before file selected
    expect(submitButton?.disabled).toBe(true);

    // Select revision PDF file
    const revisionFile = new File(["kontrak revisi v2"], "proposal-rev.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        value: [revisionFile],
        writable: true,
      });
      fileInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Filename displayed and submit button is enabled
    const selectedFilename = container.querySelector(
      '[data-testid="upload-version-selected-filename"]',
    );
    expect(selectedFilename?.textContent).toBe("proposal-rev.pdf");
    expect(submitButton?.disabled).toBe(false);

    // Click "Simpan"
    await act(async () => {
      submitButton?.click();
    });

    expect(onUploadMock).toHaveBeenCalledTimes(1);
    expect(isOpen).toBe(false);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  // AC-21.03: Menolak versi baru dengan konten identik (Negative Path)
  test("AC-21.03: renders identical-content error in-place and keeps dialog open", async () => {
    let isOpen = true;
    const handleOpenChange = (open: boolean) => {
      isOpen = open;
    };
    const onUploadMock = mock(async (_file: File) => {
      throw new ApiError(409, "IDENTICAL_CONTENT", ERROR_MESSAGES.IDENTICAL_CONTENT);
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function TestHost() {
      const [open, setOpen] = useState(true);
      return (
        <UploadVersionDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            handleOpenChange(next);
          }}
          onUpload={onUploadMock}
        />
      );
    }

    await act(async () => {
      root.render(<TestHost />);
    });

    const fileInput = container.querySelector<HTMLInputElement>(
      '[data-testid="upload-version-file-input"]',
    );
    const submitButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="upload-version-submit"]',
    );

    const identicalFile = new File(["identical content"], "proposal.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        value: [identicalFile],
        writable: true,
      });
      fileInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Click "Simpan"
    await act(async () => {
      submitButton?.click();
    });

    expect(onUploadMock).toHaveBeenCalledTimes(1);
    // Dialog must stay open (isOpen is still true)
    expect(isOpen).toBe(true);

    // Error is rendered in-place verbatim per AC-21.03
    const errorAlert = container.querySelector('[data-testid="upload-version-error"]');
    expect(errorAlert).not.toBeNull();
    expect(errorAlert?.textContent).toContain("Isi file sama dengan versi yang sudah ada");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  test("rejects unsupported file type in-place and does not call onUpload", async () => {
    const onUploadMock = mock(async (_file: File) => {});

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <UploadVersionDialog open={true} onOpenChange={() => {}} onUpload={onUploadMock} />,
      );
    });

    const fileInput = container.querySelector<HTMLInputElement>(
      '[data-testid="upload-version-file-input"]',
    );

    const unsupportedFile = new File(["binary"], "app.exe", {
      type: "application/octet-stream",
    });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        value: [unsupportedFile],
        writable: true,
      });
      fileInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const errorAlert = container.querySelector('[data-testid="upload-version-error"]');
    expect(errorAlert).not.toBeNull();
    expect(errorAlert?.textContent).toContain(ERROR_MESSAGES.UNSUPPORTED_TYPE);
    expect(onUploadMock).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  test("canceling dialog triggers onOpenChange(false)", async () => {
    let closed = false;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <UploadVersionDialog
          open={true}
          onOpenChange={(next) => {
            if (!next) closed = true;
          }}
          onUpload={async () => {}}
        />,
      );
    });

    const cancelButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="upload-version-cancel"]',
    );
    expect(cancelButton).not.toBeNull();

    await act(async () => {
      cancelButton?.click();
    });

    expect(closed).toBe(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
