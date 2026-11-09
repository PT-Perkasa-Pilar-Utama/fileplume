import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { JSX } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { TrayItem } from "../types.ts";
import { UploadFileItem } from "./upload-file-item.tsx";

const DOCUMENT_ID = "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01";
const VERSION_ID = "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e02";
const UPLOADER_ID = "22222222-2222-4222-8222-222222222222";

function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

async function createDetailRouter(ui: JSX.Element, queryClient: QueryClient) {
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <div>{ui}</div>
      </QueryClientProvider>
    ),
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
  return router;
}

async function mountWithDetailRoute(
  ui: JSX.Element,
  queryClient: QueryClient,
): Promise<{
  container: HTMLDivElement;
  cleanup: () => Promise<void>;
}> {
  const router = await createDetailRouter(ui, queryClient);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<RouterProvider router={router} />);
  });
  return {
    container,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      queryClient.clear();
      container.remove();
    },
  };
}

describe("UploadFileItem processing status polling (FE-S3-01)", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  // AC-44.01: Status pemrosesan tampil pada item unggahan
  test("AC-44.01: resolves both detail and processing status queries independently and badge shows Siap", async () => {
    const item: TrayItem = {
      id: "test-ready",
      file: new File(["data"], "dokumen-selesai.pdf"),
      filename: "dokumen-selesai.pdf",
      sizeBytes: 20 * 1024,
      progress: 100,
      status: "accepted",
      document: {
        id: DOCUMENT_ID,
        title: "dokumen-selesai.pdf",
        processingState: "queued",
        processingLabel: "Antre",
      },
    };

    fetchSpy.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(`/api/v1/documents/${DOCUMENT_ID}/processing`)) {
        return new Response(
          JSON.stringify({
            data: {
              documentId: DOCUMENT_ID,
              state: "ready",
              label: "Siap",
              failureReason: null,
              searchable: true,
              updatedAt: "2026-10-13T00:00:00.000Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes(`/api/v1/documents/${DOCUMENT_ID}`)) {
        return new Response(
          JSON.stringify({
            data: {
              id: DOCUMENT_ID,
              title: "dokumen-selesai.pdf",
              filename: "dokumen-selesai.pdf",
              mimeType: "application/pdf",
              fileType: "pdf",
              sizeBytes: 20 * 1024,
              pageCount: null,
              versionNumber: 1,
              versionCount: 1,
              processingState: "ready",
              processingLabel: "Siap",
              failureReason: null,
              uploader: { id: UPLOADER_ID, name: "User" },
              category: null,
              documentType: null,
              tags: [],
              downloadAllowed: true,
              createdAt: "2026-10-13T00:00:00.000Z",
              metadata: null,
              versions: [
                {
                  id: VERSION_ID,
                  versionNumber: 1,
                  filename: "dokumen-selesai.pdf",
                  sizeBytes: 20 * 1024,
                  pageCount: null,
                  uploadedBy: { id: UPLOADER_ID, name: "User" },
                  createdAt: "2026-10-13T00:00:00.000Z",
                  isCurrent: true,
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const queryClient = createQueryClient();
    const { container, cleanup } = await mountWithDetailRoute(
      <UploadFileItem item={item} />,
      queryClient,
    );

    try {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      const badge = container.querySelector('[data-testid="upload-item-status-test-ready"]');
      expect(badge?.textContent).toBe("Siap");
    } finally {
      await cleanup();
    }
  });
});
