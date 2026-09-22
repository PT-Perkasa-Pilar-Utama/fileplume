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
import { DocumentCardGrid, DocumentCardGridView } from "./document-card-grid.tsx";

const MOCK_DOCS: DocumentView[] = [
  {
    id: "3c7e5b21-9a04-4d18-b6f2-8e0a1c2d3e4f",
    title: "kontrak-kerjasama.pdf",
    filename: "kontrak-kerjasama.pdf",
    mimeType: "application/pdf",
    fileType: "pdf",
    sizeBytes: 1048576,
    pageCount: 10,
    versionNumber: 1,
    versionCount: 1,
    processingState: "ready",
    processingLabel: "Siap",
    failureReason: null,
    uploader: {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      name: "Sari Dewi",
    },
    category: null,
    documentType: "Kontrak",
    tags: ["legal"],
    downloadAllowed: true,
    createdAt: "2026-09-01T10:00:00.000Z",
  },
  {
    id: "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
    title: "rencana-kerja.docx",
    filename: "rencana-kerja.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileType: "docx",
    sizeBytes: 512000,
    pageCount: 3,
    versionNumber: 1,
    versionCount: 1,
    processingState: "processing",
    processingLabel: "Diproses",
    failureReason: null,
    uploader: {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      name: "Budi Santoso",
    },
    category: null,
    documentType: "Proposal",
    tags: ["planning"],
    downloadAllowed: true,
    createdAt: "2026-09-02T11:00:00.000Z",
  },
];

async function renderWithRouter(component: React.ReactElement): Promise<string> {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => component,
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

describe("DocumentCardGrid component (US-38, AC-38.01, AC-38.02, AC-38.03, AC-01.02)", () => {
  test("renders loading skeleton state when isLoading is true", () => {
    const html = renderToString(
      <DocumentCardGridView documents={[]} isLoading={true} isError={false} />,
    );

    expect(html).toContain('data-testid="documents-grid-loading"');
    expect(html).toContain('data-testid="document-card-skeleton"');
  });

  test("renders error alert when isError is true", () => {
    const html = renderToString(
      <DocumentCardGridView
        documents={[]}
        isLoading={false}
        isError={true}
        errorMessage="Koneksi bermasalah"
      />,
    );

    expect(html).toContain('data-testid="documents-grid-error"');
    expect(html).toContain("Koneksi bermasalah");
  });

  // AC-38.03: Dasbor tanpa dokumen
  test("AC-38.03: renders empty state when documents array is empty", () => {
    const html = renderToString(
      <DocumentCardGridView documents={[]} isLoading={false} isError={false} />,
    );

    expect(html).toContain('data-testid="documents-empty-state"');
    expect(html).toContain("Belum ada dokumen. Seret file ke area unggah untuk memulai");
  });

  // AC-38.01, AC-38.02, AC-01.02: Grid kartu dokumen visual
  test("AC-38.01, AC-38.02: renders responsive grid of visual document cards", async () => {
    const html = await renderWithRouter(<DocumentCardGrid documents={MOCK_DOCS} />);

    expect(html).toContain('data-testid="documents-grid"');
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("md:grid-cols-3");
    expect(html).toContain("lg:grid-cols-4");

    // Kartu pertama
    expect(html).toContain(`data-testid="document-card-${MOCK_DOCS[0]?.id}"`);
    expect(html).toContain("kontrak-kerjasama.pdf");
    expect(html).toContain('data-testid="file-icon-pdf"');
    expect(html).toContain("Siap");
    expect(html).toContain("Sari Dewi");
    expect(html).toContain(`href="/documents/${MOCK_DOCS[0]?.id}"`);

    // Kartu kedua
    expect(html).toContain(`data-testid="document-card-${MOCK_DOCS[1]?.id}"`);
    expect(html).toContain("rencana-kerja.docx");
    expect(html).toContain('data-testid="file-icon-docx"');
    expect(html).toContain("Diproses");
    expect(html).toContain("Budi Santoso");
    expect(html).toContain(`href="/documents/${MOCK_DOCS[1]?.id}"`);
  });

  test("connects to useDocuments when rendered with QueryClientProvider", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["documents", undefined], {
      data: MOCK_DOCS,
      meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });

    const html = await renderWithRouter(
      <QueryClientProvider client={queryClient}>
        <DocumentCardGrid />
      </QueryClientProvider>,
    );

    expect(html).toContain('data-testid="documents-grid"');
    expect(html).toContain("kontrak-kerjasama.pdf");
    expect(html).toContain("rencana-kerja.docx");
  });
});
