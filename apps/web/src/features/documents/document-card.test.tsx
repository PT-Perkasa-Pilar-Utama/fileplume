import { describe, expect, test } from "bun:test";
import type { DocumentView } from "@archiva/shared";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { DocumentCard } from "./document-card.tsx";

const BASE_DOC: DocumentView = {
  id: "3c7e5b21-9a04-4d18-b6f2-8e0a1c2d3e4f",
  title: "laporan-tahunan.pdf",
  filename: "laporan-tahunan.pdf",
  mimeType: "application/pdf",
  fileType: "pdf",
  sizeBytes: 2048576,
  pageCount: 15,
  versionNumber: 1,
  versionCount: 1,
  processingState: "ready",
  processingLabel: "Siap",
  failureReason: null,
  uploader: {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    name: "Budi Santoso",
  },
  category: {
    id: "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    name: "Laporan",
    isSuggestion: false,
    isSystem: false,
  },
  documentType: "Laporan Tahunan",
  tags: ["annual", "finance"],
  downloadAllowed: true,
  createdAt: "2026-09-01T08:30:00.000Z",
};

async function renderCardWithRouter(doc: DocumentView = BASE_DOC): Promise<string> {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <DocumentCard document={doc} />,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/documents/$id",
    component: () => <div>Detail</div>,
  });

  const routeTree = rootRoute.addChildren([indexRoute, detailRoute]);
  const history = createMemoryHistory({ initialEntries: ["/"] });
  const router = createRouter({ routeTree, history });
  await router.load();

  return renderToString(<RouterProvider router={router} />);
}

describe("DocumentCard component (AC-38.01, AC-01.02)", () => {
  // AC-38.01: Setiap dokumen ditampilkan sebagai kartu visual berisi: ikon, judul, tanggal, uploader, status
  test("AC-38.01: renders document card with file icon, title, date, uploader, and status", async () => {
    const html = await renderCardWithRouter(BASE_DOC);

    // Ikon tipe file PDF
    expect(html).toContain('data-testid="file-icon-pdf"');

    // Judul dokumen
    expect(html).toContain("laporan-tahunan.pdf");
    expect(html).toContain(`data-testid="document-title-${BASE_DOC.id}"`);

    // Tanggal unggah bahasa Indonesia
    expect(html).toContain(`data-testid="document-date-${BASE_DOC.id}"`);
    expect(html).toMatch(/1\s+[A-Za-z.]+\s+2026/);

    // Nama pengunggah
    expect(html).toContain("Budi Santoso");
    expect(html).toContain(`data-testid="document-uploader-${BASE_DOC.id}"`);

    // Status pemrosesan verbatim dari server
    expect(html).toContain("Siap");
    expect(html).toContain(`data-testid="document-status-${BASE_DOC.id}"`);
  });

  // Navigasi dari kartu ke detail dokumen
  test("card links to the document detail route", async () => {
    const html = await renderCardWithRouter(BASE_DOC);

    expect(html).toContain(`href="/documents/${BASE_DOC.id}"`);
    expect(html).toContain('aria-label="Buka detail dokumen laporan-tahunan.pdf"');
  });

  // AC-01.02: Memastikan tanggal unggah muncul pada kartu dokumen
  test("AC-01.02: displays formatted upload date on document card", async () => {
    const todayDoc: DocumentView = {
      ...BASE_DOC,
      createdAt: new Date().toISOString(),
    };
    const html = await renderCardWithRouter(todayDoc);

    expect(html).toContain(`data-testid="document-date-${BASE_DOC.id}"`);
    expect(html).toContain(String(new Date().getFullYear()));
  });

  test("renders different file types correctly", async () => {
    const docxDoc: DocumentView = {
      ...BASE_DOC,
      fileType: "docx",
      title: "proposal.docx",
    };
    const html = await renderCardWithRouter(docxDoc);
    expect(html).toContain('data-testid="file-icon-docx"');
  });

  test("renders processing and failed badges with their server labels", async () => {
    const processingDoc: DocumentView = {
      ...BASE_DOC,
      processingState: "processing",
      processingLabel: "Diproses",
    };
    const htmlProc = await renderCardWithRouter(processingDoc);
    expect(htmlProc).toContain("Diproses");

    const failedDoc: DocumentView = {
      ...BASE_DOC,
      processingState: "failed",
      processingLabel: "Gagal",
    };
    const htmlFailed = await renderCardWithRouter(failedDoc);
    expect(htmlFailed).toContain("Gagal");
  });
});
