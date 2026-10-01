import { describe, expect, mock, test } from "bun:test";
import { ERROR_MESSAGES } from "@archiva/shared";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { UploadVersionDialog } from "./upload-version-dialog.tsx";

describe("UploadVersionDialog rendering and validation (FE-S2-06)", () => {
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
    expect(html).toContain("Format: PDF, DOCX, XLSX, TXT (Maks. 20 MB)");
  });

  test("renders custom maxFileSizeMb in dropzone prompt and enforces limit", async () => {
    const onUploadMock = mock(async (_file: File) => {});
    const html = renderToString(
      <UploadVersionDialog
        open={true}
        onOpenChange={() => {}}
        onUpload={onUploadMock}
        maxFileSizeMb={5}
      />,
    );
    expect(html).toContain("Format: PDF, DOCX, XLSX, TXT (Maks. 5 MB)");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <UploadVersionDialog
          open={true}
          onOpenChange={() => {}}
          onUpload={onUploadMock}
          maxFileSizeMb={5}
        />,
      );
    });

    const fileInput = container.querySelector<HTMLInputElement>(
      '[data-testid="upload-version-file-input"]',
    );
    const oversizedFile = new File([new Uint8Array(6 * 1024 * 1024)], "large.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        value: [oversizedFile],
        writable: true,
      });
      fileInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const errorAlert = container.querySelector('[data-testid="upload-version-error"]');
    expect(errorAlert).not.toBeNull();
    expect(errorAlert?.textContent).toContain("Ukuran file melebihi batas 5 MB");
    expect(onUploadMock).not.toHaveBeenCalled();

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
