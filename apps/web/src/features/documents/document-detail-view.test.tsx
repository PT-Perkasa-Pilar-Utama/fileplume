import { describe, expect, test } from "bun:test";
import { type DocumentDetailView, type DocumentVersionView, EMPTY_STATE } from "@archiva/shared";
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
import { DocumentDetailView as DocumentDetailViewComponent } from "./document-detail-view.tsx";

const mockVersion1: DocumentVersionView = {
  id: "version-1-id",
  versionNumber: 1,
  filename: "kontrak-kerjasama-v1.pdf",
  sizeBytes: 2400000,
  pageCount: 40,
  uploadedBy: { id: "user-1", name: "Budi Santoso" },
  createdAt: "2026-09-01T09:00:00.000Z",
  isCurrent: false,
};

const mockVersion2: DocumentVersionView = {
  id: "version-2-id",
  versionNumber: 2,
  filename: "kontrak-kerjasama-v2.pdf",
  sizeBytes: 2411520,
  pageCount: 42,
  uploadedBy: { id: "user-1", name: "Budi Santoso" },
  createdAt: "2026-09-09T10:15:00.000Z",
  isCurrent: true,
};

const mockDocumentDetail: DocumentDetailView = {
  id: "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
  title: "kontrak-kerjasama.pdf",
  filename: "kontrak-kerjasama.pdf",
  mimeType: "application/pdf",
  fileType: "pdf",
  sizeBytes: 2411520,
  pageCount: 42,
  versionNumber: 2,
  versionCount: 2,
  processingState: "ready",
  processingLabel: "Siap",
  failureReason: null,
  uploader: { id: "user-1", name: "Budi Santoso" },
  category: {
    id: "category-1",
    name: "Legal Corporate",
    isSuggestion: false,
    isSystem: false,
  },
  documentType: "Kontrak Kerjasama",
  tags: ["legal", "mitra-2026"],
  downloadAllowed: true,
  metadata: {
    author: "Sari Dewi",
    documentCreatedAt: "2026-03-04T00:00:00.000Z",
  },
  versions: [mockVersion2, mockVersion1],
  createdAt: "2026-09-01T09:00:00.000Z",
};

async function renderDetailView(
  ui: JSX.Element,
  routePath = "/documents/0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
): Promise<string> {
  const rootRoute = createRootRoute({
    component: () => <div>{ui}</div>,
  });

  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: () => <div>Dashboard</div>,
  });

  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/documents/$id",
    component: () => <div>Detail</div>,
  });

  rootRoute.addChildren([dashboardRoute, detailRoute]);
  const history = createMemoryHistory({ initialEntries: [routePath] });
  const router = createRouter({ routeTree: rootRoute, history });
  await router.load();

  return renderToString(<RouterProvider router={router} />);
}

describe("DocumentDetailView (FE-S2-04)", () => {
  // AC-38.02: Navigasi dari kartu ke detail dokumen
  // Halaman detail dokumen terbuka menampilkan metadata, extracted fields, dan preview
  test("AC-38.02: renders metadata, extracted fields, and preview regions", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["document", mockDocumentDetail.id], mockDocumentDetail);
    queryClient.setQueryData(["document-preview", mockDocumentDetail.id, mockVersion2.id], {
      blob: new Blob(["preview"]),
      url: "blob:preview-v2-url",
    });

    const html = await renderDetailView(
      <QueryClientProvider client={queryClient}>
        <DocumentDetailViewComponent documentId={mockDocumentDetail.id} />
      </QueryClientProvider>,
    );

    // Breadcrumb matching Figma 28:3451
    expect(html).toContain("DOCUMENT MANAGEMENT");
    expect(html).toContain("DETAIL");

    // Three required regions per AC-38.02
    expect(html).toContain('data-testid="document-metadata-region"');
    expect(html).toContain('data-testid="document-extracted-fields-region"');
    expect(html).toContain('data-testid="document-preview-region"');

    // Metadata contents
    expect(html).toContain("kontrak-kerjasama.pdf");
    expect(html).toContain("Legal Corporate");
    expect(html).toContain("Budi Santoso");
    expect(html).toContain("Sari Dewi");
    expect(html).toContain("Siap");
    expect(html).toContain("legal");
    expect(html).toContain("mitra-2026");

    // Extracted fields stub content
    expect(html).toContain("Kontrak Kerjasama");
    expect(html).toContain('data-testid="extracted-fields-placeholder"');
    expect(html).toContain("Sprint 3");

    // Preview viewer and toolbar matching Figma 28:3451
    expect(html).toContain('data-testid="document-preview-viewer"');
    expect(html).toContain('data-testid="preview-page-indicator"');
    expect(html).toContain("1 / 42");

    // Related documents region (Figma 28:3451)
    expect(html).toContain('data-testid="document-related-region"');
  });

  // AC-21.02: Mengakses versi lama melalui version picker
  // Viewer menampilkan isi dokumen versi aktif dan tombol "Download" mengunduh file
  test("AC-21.02: renders version picker and Download button", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["document", mockDocumentDetail.id], mockDocumentDetail);

    const html = await renderDetailView(
      <QueryClientProvider client={queryClient}>
        <DocumentDetailViewComponent documentId={mockDocumentDetail.id} />
      </QueryClientProvider>,
    );

    // Version picker trigger is present with active version
    expect(html).toContain('data-testid="version-picker-trigger"');
    expect(html).toContain("Version 2.0");

    // Download button exists with verbatim label "Download" per AC-21.02
    expect(html).toContain('data-testid="download-button"');
    expect(html).toContain("Download");
  });

  test("renders 404 empty state when document is not found", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // Set query cache to null/undefined error
    queryClient.setQueryData(["document", "not-found-id"], null);

    const html = await renderDetailView(
      <QueryClientProvider client={queryClient}>
        <DocumentDetailViewComponent documentId="not-found-id" />
      </QueryClientProvider>,
    );

    expect(html).toContain('data-testid="document-detail-error"');
    expect(html).toContain(EMPTY_STATE.DOCUMENT_NOT_FOUND);
    expect(html).toContain("Kembali ke Dasbor");
  });

  test("renders loading state while document is being fetched", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const html = await renderDetailView(
      <QueryClientProvider client={queryClient}>
        <DocumentDetailViewComponent documentId="loading-id" />
      </QueryClientProvider>,
    );

    expect(html).toContain('data-testid="document-detail-loading"');
    expect(html).toContain("Memuat detail dokumen...");
  });
});
