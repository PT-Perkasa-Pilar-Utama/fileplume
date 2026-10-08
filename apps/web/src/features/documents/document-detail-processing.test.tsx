import { describe, expect, test } from "bun:test";
import type { DocumentDetailView, DocumentVersionView, FailureReason } from "@archiva/shared";
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
import { DOCUMENT_QUERY_KEY } from "./use-document-detail.ts";

const mockVersion: DocumentVersionView = {
  id: "version-1-id",
  versionNumber: 1,
  filename: "laporan-keuangan.pdf",
  sizeBytes: 1048576,
  pageCount: null,
  uploadedBy: { id: "user-1", name: "Budi Santoso" },
  createdAt: "2026-09-01T09:00:00.000Z",
  isCurrent: true,
};

const createFailedDocument = (code: FailureReason, message: string): DocumentDetailView => ({
  id: "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
  title: "laporan-keuangan.pdf",
  filename: "laporan-keuangan.pdf",
  mimeType: "application/pdf",
  fileType: "pdf",
  sizeBytes: 1048576,
  pageCount: null,
  versionNumber: 1,
  versionCount: 1,
  processingState: "failed",
  processingLabel: "Gagal",
  failureReason: { code, message },
  uploader: { id: "user-1", name: "Budi Santoso" },
  category: {
    id: "category-1",
    name: "Keuangan",
    isSuggestion: false,
    isSystem: false,
  },
  documentType: null,
  tags: [],
  downloadAllowed: true,
  metadata: null,
  versions: [mockVersion],
  createdAt: "2026-09-01T09:00:00.000Z",
});

async function renderDetailView(ui: JSX.Element): Promise<string> {
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
  const history = createMemoryHistory({
    initialEntries: ["/documents/0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01"],
  });
  const router = createRouter({ routeTree: rootRoute, history });
  await router.load();

  return renderToString(<RouterProvider router={router} />);
}

describe("DocumentDetailView processing failure presentation (AC-44.03, AC-44.04, AC-44.05)", () => {
  // AC-44.03: Kegagalan permanen ditandai dan dokumen tetap dapat digunakan
  test("AC-44.03: renders Gagal status and failure reason in metadata panel, download button remains active", async () => {
    const doc = createFailedDocument("extraction_timeout", "Waktu ekstraksi dokumen habis");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData([...DOCUMENT_QUERY_KEY, doc.id], doc);

    const html = await renderDetailView(
      <QueryClientProvider client={queryClient}>
        <DocumentDetailViewComponent documentId={doc.id} />
      </QueryClientProvider>,
    );

    expect(html).toContain("Gagal");
    expect(html).toContain("Waktu ekstraksi dokumen habis");
    expect(html).toContain('data-testid="metadata-failure-reason"');
    // AC-44.03: Dokumen tetap dapat diunduh (tombol download tetap ada dan tidak disabled)
    expect(html).toContain('data-testid="download-button"');
    expect(html).not.toMatch(/data-testid="download-button"[^>]*disabled/);
  });

  // AC-44.04: Dokumen PDF terproteksi password
  test("AC-44.04: renders password protected reason verbatim and allows download", async () => {
    const doc = createFailedDocument("password_protected", "Dokumen terproteksi password");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData([...DOCUMENT_QUERY_KEY, doc.id], doc);

    const html = await renderDetailView(
      <QueryClientProvider client={queryClient}>
        <DocumentDetailViewComponent documentId={doc.id} />
      </QueryClientProvider>,
    );

    expect(html).toContain("Gagal");
    expect(html).toContain("Dokumen terproteksi password");
    expect(html).toContain('data-testid="download-button"');
    expect(html).not.toMatch(/data-testid="download-button"[^>]*disabled/);
  });

  // AC-44.05: Dokumen rusak atau kosong
  test("AC-44.05: renders unreadable content reason without triggering error page", async () => {
    const doc = createFailedDocument("unreadable_content", "Isi dokumen tidak dapat dibaca");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData([...DOCUMENT_QUERY_KEY, doc.id], doc);

    const html = await renderDetailView(
      <QueryClientProvider client={queryClient}>
        <DocumentDetailViewComponent documentId={doc.id} />
      </QueryClientProvider>,
    );

    expect(html).toContain("Gagal");
    expect(html).toContain("Isi dokumen tidak dapat dibaca");
    expect(html).toContain('data-testid="metadata-failure-reason"');
    // UI tidak menampilkan halaman error 500
    expect(html).not.toContain('data-testid="document-detail-error"');
  });
});
