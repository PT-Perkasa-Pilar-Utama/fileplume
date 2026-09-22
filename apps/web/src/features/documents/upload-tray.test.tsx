import { describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { JSX } from "react";
import { renderToString } from "react-dom/server";
import { DashboardView } from "../../routes/views.tsx";
import { Dropzone, type TrayItem, UploadTray } from "./index.ts";

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

describe("UploadTray & Upload Area components (FE-S2-01)", () => {
  test("Dropzone renders upload area prompt and accepted file extensions", async () => {
    const html = await renderWithProviders(<Dropzone onFilesSelected={() => {}} />);

    expect(html).toContain("Click to upload or Drag and Drop file here");
    expect(html).toContain("(PDF, DOCX, XLSX, TXT)");
    expect(html).toContain('data-testid="upload-file-input"');
  });

  test("UploadTray renders container header UPLOAD AREA", async () => {
    const html = await renderWithProviders(<UploadTray />);

    expect(html).toContain("UPLOAD AREA");
    expect(html).toContain("Upload your document below");
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
    const items: TrayItem[] = [
      {
        id: "test-3a",
        file: new File(["c1"], "surat-1.docx"),
        filename: "surat-1.docx",
        sizeBytes: 15 * 1024,
        progress: 100,
        status: "accepted",
        document: {
          id: "doc-1",
          title: "surat-1.docx",
          processingState: "queued",
          processingLabel: "Diproses",
        },
      },
      {
        id: "test-3b",
        file: new File(["c2"], "surat-2.docx"),
        filename: "surat-2.docx",
        sizeBytes: 20 * 1024,
        progress: 100,
        status: "accepted",
        document: {
          id: "doc-2",
          title: "surat-2.docx",
          processingState: "queued",
          processingLabel: "Diproses",
        },
      },
      {
        id: "test-3c",
        file: new File(["c3"], "surat-3.docx"),
        filename: "surat-3.docx",
        sizeBytes: 25 * 1024,
        progress: 100,
        status: "accepted",
        document: {
          id: "doc-3",
          title: "surat-3.docx",
          processingState: "queued",
          processingLabel: "Diproses",
        },
      },
    ];

    const html = await renderWithProviders(<UploadTray initialItems={items} />);

    expect(html).toContain("surat-1.docx");
    expect(html).toContain("surat-2.docx");
    expect(html).toContain("surat-3.docx");
    const successOccurrences = html.split("File diterima untuk diproses").length - 1;
    expect(successOccurrences).toBe(3);
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

  test("DashboardView mounts UploadTray and UploadedDocumentsList", async () => {
    const html = await renderWithProviders(<DashboardView />);

    expect(html).toContain("UPLOAD AREA");
    expect(html).toContain("Upload your document below");
    expect(html).toContain("Click to upload or Drag and Drop file here");
    expect(html).toContain("UPLOADED DOCUMENT");
    expect(html).toContain("No Document Uploaded");
  });
});
