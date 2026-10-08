import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { DocumentView } from "@archiva/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act } from "react";
import { createRoot } from "react-dom/client";
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

describe("DocumentCard processing presentation (FE-S3-01, AC-44.01, AC-44.03, AC-44.04, AC-44.05)", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  // AC-44.01: Status pemrosesan tampil pada dokumen: Antre, Diproses, Siap, Gagal verbatim
  test("AC-44.01: renders all four server-driven status labels verbatim", async () => {
    const states: Array<{ state: DocumentView["processingState"]; label: string }> = [
      { state: "queued", label: "Antre" },
      { state: "processing", label: "Diproses" },
      { state: "ready", label: "Siap" },
      { state: "failed", label: "Gagal" },
    ];

    for (const { state, label } of states) {
      const doc: DocumentView = {
        ...BASE_DOC,
        processingState: state,
        processingLabel: label,
      };
      const html = await renderCardWithRouter(doc);
      expect(html).toContain(label);
      expect(html).toContain(`data-testid="document-status-${doc.id}"`);
    }
  });

  // AC-44.03: Kegagalan permanen ditandai dan dokumen tetap dapat digunakan
  test("AC-44.03: renders failure reason message when state is failed and keeps detail link active", async () => {
    const failedDoc: DocumentView = {
      ...BASE_DOC,
      processingState: "failed",
      processingLabel: "Gagal",
      failureReason: {
        code: "extraction_timeout",
        message: "Waktu pemrosesan dokumen habis",
      },
    };

    const html = await renderCardWithRouter(failedDoc);

    expect(html).toContain("Gagal");
    expect(html).toContain("Waktu pemrosesan dokumen habis");
    expect(html).toContain(`data-testid="document-failure-reason-${failedDoc.id}"`);
    expect(html).toContain(`href="/documents/${failedDoc.id}"`);
  });

  // AC-44.04: Dokumen PDF terproteksi password
  test("AC-44.04: renders password protected failure reason verbatim on document card", async () => {
    const passwordDoc: DocumentView = {
      ...BASE_DOC,
      processingState: "failed",
      processingLabel: "Gagal",
      failureReason: {
        code: "password_protected",
        message: "Dokumen terproteksi password",
      },
    };

    const html = await renderCardWithRouter(passwordDoc);

    expect(html).toContain("Gagal");
    expect(html).toContain("Dokumen terproteksi password");
    expect(html).toContain(`href="/documents/${passwordDoc.id}"`);
  });

  // AC-44.05: Dokumen rusak atau kosong
  test("AC-44.05: renders unreadable content failure reason verbatim without crashing", async () => {
    const corruptedDoc: DocumentView = {
      ...BASE_DOC,
      processingState: "failed",
      processingLabel: "Gagal",
      failureReason: {
        code: "unreadable_content",
        message: "Isi dokumen tidak dapat dibaca",
      },
    };

    const html = await renderCardWithRouter(corruptedDoc);

    expect(html).toContain("Gagal");
    expect(html).toContain("Isi dokumen tidak dapat dibaca");
    expect(html).toContain(`data-testid="document-failure-reason-${corruptedDoc.id}"`);
  });

  // AC-44.01: Status berubah otomatis menjadi "Siap" setelah seluruh pemrosesan selesai
  test("AC-44.01: card updates processing label dynamically when polled state becomes ready", async () => {
    const queuedDoc: DocumentView = {
      ...BASE_DOC,
      processingState: "queued",
      processingLabel: "Antre",
    };

    const readyPayload = {
      data: {
        documentId: queuedDoc.id,
        state: "ready",
        label: "Siap",
        failureReason: null,
        searchable: true,
        updatedAt: "2026-09-10T05:20:44.000Z",
      },
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(readyPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    const rootRoute = createRootRoute({
      component: () => (
        <QueryClientProvider client={queryClient}>
          <DocumentCard document={queuedDoc} />
        </QueryClientProvider>
      ),
    });
    const history = createMemoryHistory({ initialEntries: ["/"] });
    const router = createRouter({ routeTree: rootRoute, history });
    await router.load();

    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<RouterProvider router={router} />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    const statusBadge = container.querySelector(`[data-testid="document-status-${queuedDoc.id}"]`);
    expect(statusBadge?.textContent).toBe("Siap");

    act(() => {
      root.unmount();
    });
  });
});
