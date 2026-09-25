import { describe, expect, test } from "bun:test";
import { EMPTY_STATE } from "@archiva/shared";
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
import type { UploadedDocumentDisplay } from "./types.ts";
import { UploadedDocumentsList } from "./uploaded-documents-list.tsx";

async function renderWithRouter(ui: JSX.Element): Promise<string> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rootRoute = createRootRoute({
    component: () => <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/documents/$id",
    component: () => <div>Detail</div>,
  });
  rootRoute.addChildren([detailRoute]);
  const history = createMemoryHistory({ initialEntries: ["/"] });
  const router = createRouter({ routeTree: rootRoute, history });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

describe("UploadedDocumentsList component (FE-S2-01)", () => {
  test("renders empty state when no documents exist", async () => {
    const html = await renderWithRouter(<UploadedDocumentsList documents={[]} />);

    expect(html).toContain("UPLOADED DOCUMENT");
    expect(html).toContain(
      "Repositori file dan catatan yang diunggah untuk akses dan verifikasi cepat.",
    );
    expect(html).toContain(EMPTY_STATE.NO_DOCUMENTS);
  });

  test("renders document cards when documents exist", async () => {
    const docs: UploadedDocumentDisplay[] = [
      {
        id: "doc-1",
        title: "laporan-q3.pdf",
        fileType: "pdf",
        sizeBytes: 150 * 1024,
        processingState: "queued",
        processingLabel: "Diproses",
        uploaderName: "Member Team",
        createdAt: "Hari ini",
      },
    ];

    const html = await renderWithRouter(<UploadedDocumentsList documents={docs} />);

    expect(html).toContain("UPLOADED DOCUMENT");
    expect(html).toContain("laporan-q3.pdf");
    expect(html).toContain("Diproses");
    expect(html).toContain("Member Team");
    expect(html).toContain("Hari ini");
    expect(html).toContain("150.0 KB");
  });

  // AC-38.02: Navigasi dari kartu ke detail dokumen
  test("AC-38.02: document card renders link to /documents/:id", async () => {
    const docId = "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01";
    const docs: UploadedDocumentDisplay[] = [
      {
        id: docId,
        title: "kontrak-kerjasama.pdf",
        fileType: "pdf",
        sizeBytes: 2400000,
        processingState: "ready",
        processingLabel: "Siap",
        uploaderName: "Budi Santoso",
        createdAt: "Hari ini",
      },
    ];

    const html = await renderWithRouter(<UploadedDocumentsList documents={docs} />);

    expect(html).toContain(`data-testid="uploaded-doc-${docId}"`);
    expect(html).toContain(`href="/documents/${docId}"`);
  });
});
