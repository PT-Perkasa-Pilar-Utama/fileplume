import { describe, expect, test } from "bun:test";
import type { DocumentView } from "@archiva/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { DashboardView } from "./views.tsx";

const MOCK_DOC: DocumentView = {
  id: "3c7e5b21-9a04-4d18-b6f2-8e0a1c2d3e4f",
  title: "laporan-keuangan.pdf",
  filename: "laporan-keuangan.pdf",
  mimeType: "application/pdf",
  fileType: "pdf",
  sizeBytes: 1048576,
  pageCount: 12,
  versionNumber: 1,
  versionCount: 1,
  processingState: "ready",
  processingLabel: "Siap",
  failureReason: null,
  uploader: {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    name: "Ahmad Staff",
  },
  category: null,
  documentType: "Report",
  tags: ["finance"],
  downloadAllowed: true,
  createdAt: "2026-09-01T10:00:00.000Z",
};

async function renderDashboard(docs: DocumentView[] = [MOCK_DOC]): Promise<string> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(["documents", undefined], {
    data: docs,
    meta: { page: 1, limit: 10, total: docs.length, totalPages: 1 },
  });

  const rootRoute = createRootRoute();
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: DashboardView,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/documents/$id",
    component: () => <div>Detail</div>,
  });

  const routeTree = rootRoute.addChildren([dashboardRoute, detailRoute]);
  const history = createMemoryHistory({ initialEntries: ["/"] });
  const router = createRouter({ routeTree, history });
  await router.load();

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("DashboardView (FE-S2-03, US-38)", () => {
  // AC-38.01: Melihat dokumen terbaru sebagai kartu visual
  test("AC-38.01: renders Dokumen Terunggah section with document card", async () => {
    const html = await renderDashboard([MOCK_DOC]);

    expect(html).toContain("Dashboard");
    expect(html).toContain("Dokumen Terunggah");
    expect(html).toContain('data-testid="documents-grid"');
    expect(html).toContain("laporan-keuangan.pdf");
    expect(html).toContain("Ahmad Staff");
    expect(html).toContain("Siap");
    expect(html).toContain('data-testid="file-icon-pdf"');
  });

  // AC-38.02: Navigasi dari kartu ke detail dokumen
  test("AC-38.02: document card in dashboard links to /documents/$id", async () => {
    const html = await renderDashboard([MOCK_DOC]);

    expect(html).toContain(`href="/documents/${MOCK_DOC.id}"`);
  });

  // AC-38.03: Dasbor tanpa dokumen
  test("AC-38.03: renders empty state message when tenant has no documents", async () => {
    const html = await renderDashboard([]);

    expect(html).toContain('data-testid="documents-empty-state"');
    expect(html).toContain("Belum ada dokumen. Seret file ke area unggah untuk memulai");
  });
});
