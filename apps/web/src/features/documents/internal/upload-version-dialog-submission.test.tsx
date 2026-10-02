import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { ERROR_MESSAGES } from "@archiva/shared";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ApiError } from "../../../lib/api.ts";
import { UploadVersionDialog } from "./upload-version-dialog.tsx";

describe("UploadVersionDialog submission and errors (FE-S2-06)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  function selectFile(input: HTMLInputElement | null, file: File) {
    Object.defineProperty(input, "files", { value: [file], writable: true });
    input?.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // AC-21.01: Mengunggah versi baru melalui aksi eksplisit
  test("AC-21.01: selects revision file, enables submit, calls onUpload, and closes dialog on success", async () => {
    let isOpen = true;
    const onUploadMock = mock(async (_file: File) => {});

    function TestHost() {
      const [open, setOpen] = useState(true);
      return (
        <UploadVersionDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            isOpen = next;
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
    expect(submitButton?.disabled).toBe(true);

    const revisionFile = new File(["kontrak revisi v2"], "proposal-rev.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      selectFile(fileInput, revisionFile);
    });

    const selectedFilename = container.querySelector(
      '[data-testid="upload-version-selected-filename"]',
    );
    expect(selectedFilename?.textContent).toBe("proposal-rev.pdf");
    expect(submitButton?.disabled).toBe(false);

    await act(async () => {
      submitButton?.click();
    });

    expect(onUploadMock).toHaveBeenCalledTimes(1);
    expect(isOpen).toBe(false);
  });

  // AC-21.03: Menolak versi baru dengan konten identik (Negative Path)
  test("AC-21.03: renders identical-content error in-place and keeps dialog open", async () => {
    let isOpen = true;
    const onUploadMock = mock(async (_file: File) => {
      throw new ApiError(409, "IDENTICAL_CONTENT", ERROR_MESSAGES.IDENTICAL_CONTENT);
    });

    function TestHost() {
      const [open, setOpen] = useState(true);
      return (
        <UploadVersionDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            isOpen = next;
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
      selectFile(fileInput, identicalFile);
    });

    await act(async () => {
      submitButton?.click();
    });

    expect(onUploadMock).toHaveBeenCalledTimes(1);
    expect(isOpen).toBe(true);

    const errorAlert = container.querySelector('[data-testid="upload-version-error"]');
    expect(errorAlert).not.toBeNull();
    expect(errorAlert?.textContent).toContain("Isi file sama dengan versi yang sudah ada");
  });

  test("renders UPLOAD_INTERRUPTED on unexpected non-ApiError rejection", async () => {
    const onUploadMock = mock(async (_file: File) => {
      throw new Error("Failed to fetch");
    });

    await act(async () => {
      root.render(
        <UploadVersionDialog open={true} onOpenChange={() => {}} onUpload={onUploadMock} />,
      );
    });

    const fileInput = container.querySelector<HTMLInputElement>(
      '[data-testid="upload-version-file-input"]',
    );
    const submitButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="upload-version-submit"]',
    );

    const validFile = new File(["some content"], "doc.pdf", { type: "application/pdf" });

    await act(async () => {
      selectFile(fileInput, validFile);
    });

    await act(async () => {
      submitButton?.click();
    });

    const errorAlert = container.querySelector('[data-testid="upload-version-error"]');
    expect(errorAlert).not.toBeNull();
    expect(errorAlert?.textContent).toContain(ERROR_MESSAGES.UPLOAD_INTERRUPTED);
  });

  test("refuses to close dialog while upload is in-flight", async () => {
    let resolveUpload: () => void = () => {};
    const onUploadMock = mock(
      () =>
        new Promise<void>((resolve) => {
          resolveUpload = resolve;
        }),
    );

    let isOpen = true;
    function TestHost() {
      const [open, setOpen] = useState(true);
      return (
        <UploadVersionDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            isOpen = next;
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

    const validFile = new File(["some content"], "doc.pdf", { type: "application/pdf" });

    await act(async () => {
      selectFile(fileInput, validFile);
    });

    await act(async () => {
      submitButton?.click();
    });

    const cancelButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="upload-version-cancel"]',
    );
    expect(cancelButton?.disabled).toBe(true);

    const closeButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="dialog-close-button"]',
    );
    await act(async () => {
      closeButton?.click();
    });
    expect(isOpen).toBe(true);

    await act(async () => {
      resolveUpload();
    });

    expect(isOpen).toBe(false);
  });
});
