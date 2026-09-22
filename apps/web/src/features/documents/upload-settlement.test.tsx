import { describe, expect, test } from "bun:test";
import { EMPTY_STATE, type UploadBatch } from "@archiva/shared";
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
import { DashboardView } from "../../routes/views.tsx";
import { type TrayItem, UploadTray } from "./index.ts";

function createTestQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  client.setQueryData(["documents", undefined], {
    data: [],
    meta: { page: 1, limit: 10, total: 0, totalPages: 0, message: EMPTY_STATE.NO_DOCUMENTS },
  });
  return client;
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
      container.remove();
    },
  };
}

describe("Upload settlement & DashboardView integration (FE-S2-01)", () => {
  test("DashboardView mounts UploadTray and UploadedDocumentsList", async () => {
    const html = await renderWithProviders(<DashboardView />);

    expect(html).toContain("AREA UNGGAH");
    expect(html).toContain("Unggah dokumen Anda di bawah ini");
    expect(html).toContain("Klik untuk mengunggah atau seret dan lepas file di sini");
    expect(html).toContain("UPLOADED DOCUMENT");
    expect(html).toContain(EMPTY_STATE.NO_DOCUMENTS);
  });

  test("UploadTray passes acceptedItems with real sizeBytes to onUploadSettled", async () => {
    const settled: {
      batch: UploadBatch | null;
      acceptedItems: readonly TrayItem[];
    } = {
      batch: null,
      acceptedItems: [],
    };

    const testFile = new File(["x".repeat(50 * 1024)], "anggaran-2026.pdf", {
      type: "application/pdf",
    });

    const stubUploader = async (files: File[]): Promise<UploadBatch> => ({
      accepted: 1,
      rejected: 0,
      summary: null,
      results: [
        {
          index: 0,
          filename: files[0]?.name ?? "anggaran-2026.pdf",
          status: "accepted",
          document: {
            id: "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
            title: files[0]?.name ?? "anggaran-2026.pdf",
            processingState: "queued",
            processingLabel: "Antre",
          },
        },
      ],
    });

    const { container, cleanup } = await mountWithProviders(
      <UploadTray
        uploader={stubUploader}
        onUploadSettled={(batch, accepted) => {
          settled.batch = batch;
          settled.acceptedItems = accepted;
        }}
      />,
    );

    const fileInput = container.querySelector(
      'input[data-testid="upload-file-input"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    if (fileInput) {
      Object.defineProperty(fileInput, "files", { value: [testFile], writable: true });
      await act(async () => {
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }

    expect(settled.batch).not.toBeNull();
    expect(settled.acceptedItems).toHaveLength(1);
    const firstItem = settled.acceptedItems[0];
    if (firstItem) {
      expect(firstItem.sizeBytes).toBe(50 * 1024);
      expect(firstItem.status).toBe("accepted");
    }

    await cleanup();
  });

  test("DashboardView renders document in UploadedDocumentsList with real size and never '0 B' after upload settles", async () => {
    const testFile = new File(["x".repeat(50 * 1024)], "anggaran-2026.pdf", {
      type: "application/pdf",
    });

    const stubUploader = async (files: File[]): Promise<UploadBatch> => ({
      accepted: 1,
      rejected: 0,
      summary: null,
      results: [
        {
          index: 0,
          filename: files[0]?.name ?? "anggaran-2026.pdf",
          status: "accepted",
          document: {
            id: "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
            title: files[0]?.name ?? "anggaran-2026.pdf",
            processingState: "queued",
            processingLabel: "Antre",
          },
        },
      ],
    });

    const { container, cleanup } = await mountWithProviders(
      <DashboardView uploader={stubUploader} />,
    );

    const fileInput = container.querySelector(
      'input[data-testid="upload-file-input"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    if (fileInput) {
      Object.defineProperty(fileInput, "files", { value: [testFile], writable: true });
      await act(async () => {
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }

    const docCard = container.querySelector(
      '[data-testid="uploaded-doc-0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01"]',
    );
    expect(docCard).not.toBeNull();
    expect(docCard?.textContent).toContain("anggaran-2026.pdf");
    expect(docCard?.textContent).toContain("50.0 KB");
    expect(docCard?.textContent).not.toContain("0 B");

    await cleanup();
  });
});
