import { describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, type JSX } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { type TrayItem, UploadTray } from "./index.ts";
import { Dropzone } from "./internal/dropzone.tsx";

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

async function renderWithProviders(ui: JSX.Element): Promise<string> {
  const queryClient = createTestQueryClient();
  const rootRoute = createRootRoute({
    component: () => <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  });

  const documentDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/documents/$id",
    component: () => <div>Detail Dokumen</div>,
  });

  rootRoute.addChildren([documentDetailRoute]);
  const history = createMemoryHistory({ initialEntries: ["/"] });
  const router = createRouter({ routeTree: rootRoute, history });
  await router.load();

  return renderToString(<RouterProvider router={router} />);
}

async function mountWithProviders(ui: JSX.Element): Promise<{
  container: HTMLDivElement;
  cleanup: () => Promise<void>;
}> {
  const queryClient = createTestQueryClient();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  });
  return {
    container,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("UploadTray & Upload Area components (FE-S2-01)", () => {
  test("Dropzone renders upload area prompt and accepted file extensions", async () => {
    const html = await renderWithProviders(<Dropzone onFilesSelected={() => {}} />);

    expect(html).toContain("Klik untuk mengunggah atau seret dan lepas file di sini");
    expect(html).toContain("(PDF, DOCX, XLSX, TXT)");
    expect(html).toContain('data-testid="upload-file-input"');
  });

  test("UploadTray renders container header AREA UNGGAH", async () => {
    const html = await renderWithProviders(<UploadTray />);

    expect(html).toContain("AREA UNGGAH");
    expect(html).toContain("Unggah dokumen Anda di bawah ini");
    expect(html).toContain("Belum ada file yang diunggah");
  });

  // AC-01.01: Mengunggah satu file PDF yang valid
  test("AC-01.01: renders accepted single file with 100% progress and 'File diterima untuk diproses'", async () => {
    const file = new File(["pdf-content"], "laporan.pdf", { type: "application/pdf" });
    const items: TrayItem[] = [
      {
        id: "test-1",
        file,
        filename: "laporan.pdf",
        sizeBytes: 120 * 1024,
        progress: 100,
        status: "accepted",
        document: {
          id: "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
          title: "laporan.pdf",
          processingState: "queued",
          processingLabel: "Diproses",
        },
      },
    ];

    const html = await renderWithProviders(<UploadTray initialItems={items} />);

    // Indikator sukses dan status "Diproses"
    expect(html).toContain("laporan.pdf");
    expect(html).toContain("File diterima untuk diproses");
    expect(html).toContain("Diproses");
    expect(html).toContain('data-testid="file-icon-pdf"');
  });

  // AC-01.03: Mencoba mengunggah file tipe tidak didukung (Negative Path)
  test("AC-01.03: renders rejected unsupported file with verbatim Indonesian error message", async () => {
    const file = new File(["img-bytes"], "invoice.jpg", { type: "image/jpeg" });
    const items: TrayItem[] = [
      {
        id: "test-2",
        file,
        filename: "invoice.jpg",
        sizeBytes: 50 * 1024,
        progress: 0,
        status: "rejected",
        error: {
          code: "UNSUPPORTED_TYPE",
          message: "Tipe file tidak didukung. Tipe yang diterima: PDF, DOCX, XLSX, TXT",
        },
      },
    ];

    const html = await renderWithProviders(<UploadTray initialItems={items} />);

    expect(html).toContain("invoice.jpg");
    expect(html).toContain("Tipe file tidak didukung. Tipe yang diterima: PDF, DOCX, XLSX, TXT");
    expect(html).toContain('data-testid="file-icon-unsupported"');
  });

  // AC-01.04: Mengunggah beberapa file sekaligus
  test("AC-01.04: renders multiple accepted DOCX files with individual success indicators", async () => {
    const items: TrayItem[] = [1, 2, 3].map((num) => ({
      id: `test-3-${num}`,
      file: new File([`c${num}`], `surat-${num}.docx`),
      filename: `surat-${num}.docx`,
      sizeBytes: num * 10 * 1024,
      progress: 100,
      status: "accepted" as const,
      document: {
        id: `doc-${num}`,
        title: `surat-${num}.docx`,
        processingState: "queued" as const,
        processingLabel: "Diproses",
      },
    }));

    const html = await renderWithProviders(<UploadTray initialItems={items} />);

    expect(html).toContain("surat-1.docx");
    expect(html).toContain("surat-2.docx");
    expect(html).toContain("surat-3.docx");
    const successOccurrences = html.split("File diterima untuk diproses").length - 1;
    expect(successOccurrences).toBe(3);
  });

  // AC-01.05: Melebihi batas jumlah file sekaligus (Negative Path)
  test("AC-01.05: renders batch-error-alert when selecting more than 20 files", async () => {
    const { container, cleanup } = await mountWithProviders(<UploadTray />);

    const fileInput = container.querySelector(
      'input[data-testid="upload-file-input"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    // Create 21 files (exceeding 20 limit)
    const files: File[] = [];
    for (let i = 0; i < 21; i++) {
      files.push(new File(["content"], `doc-${i}.pdf`, { type: "application/pdf" }));
    }

    if (fileInput) {
      Object.defineProperty(fileInput, "files", {
        value: files,
        writable: true,
      });

      await act(async () => {
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }

    const alertEl = container.querySelector('[data-testid="batch-error-alert"]');
    expect(alertEl).not.toBeNull();
    expect(alertEl?.textContent).toContain("Maksimal 20 file per unggahan");

    await cleanup();
  });

  // AC-01.06: Melebihi batas ukuran file (Negative Path)
  test("AC-01.06: renders file too large error when size exceeds limit", async () => {
    const items: TrayItem[] = [
      {
        id: "test-oversized",
        file: new File(["large"], "laporan-25mb.pdf"),
        filename: "laporan-25mb.pdf",
        sizeBytes: 25 * 1024 * 1024,
        progress: 0,
        status: "rejected",
        error: {
          code: "FILE_TOO_LARGE",
          message: "Ukuran file melebihi batas 20 MB",
        },
      },
    ];

    const html = await renderWithProviders(<UploadTray initialItems={items} />);

    expect(html).toContain("laporan-25mb.pdf");
    expect(html).toContain("Ukuran file melebihi batas 20 MB");
  });
});
