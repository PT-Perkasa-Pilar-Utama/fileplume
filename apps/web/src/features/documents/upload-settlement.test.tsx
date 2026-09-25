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
import { formatDocumentDate } from "../../lib/format.ts";
import { DashboardView } from "../../routes/views.tsx";
import { useAuthStore } from "../auth/auth-store.ts";
import { type TrayItem, UploadTray } from "./index.ts";

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

async function createTestRouter(ui: JSX.Element) {
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
  return router;
}

async function renderWithProviders(ui: JSX.Element): Promise<string> {
  const router = await createTestRouter(ui);
  return renderToString(<RouterProvider router={router} />);
}

async function mountWithProviders(ui: JSX.Element): Promise<{
  container: HTMLDivElement;
  cleanup: () => Promise<void>;
}> {
  const router = await createTestRouter(ui);
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

describe("Upload settlement & DashboardView integration (FE-S2-01, FE-S2-03)", () => {
  test("DashboardView mounts UploadTray and document grid", async () => {
    const html = await renderWithProviders(<DashboardView />);

    expect(html).toContain("AREA UNGGAH");
    expect(html).toContain("Unggah dokumen Anda di bawah ini");
    expect(html).toContain("Klik untuk mengunggah atau seret dan lepas file di sini");
    expect(html).toContain("Dokumen Terunggah");
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

  test("a settled upload appears as a card with its real size and never '0 B'", async () => {
    const testFile = new File(["x".repeat(50 * 1024)], "anggaran-2026.pdf", {
      type: "application/pdf",
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
      '[data-testid="document-card-0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01"]',
    );
    expect(docCard).not.toBeNull();
    expect(docCard?.textContent).toContain("anggaran-2026.pdf");
    expect(docCard?.textContent).toContain("50.0 KB");
    expect(docCard?.textContent).not.toContain("0 B");

    await cleanup();
  });

  // AC-01.02: Tanggal unggah dan pengunggah pada kartu dokumen yang baru diselesaikan
  test("AC-01.02: settled upload card displays today's formatted date and signed-in user name", async () => {
    useAuthStore.getState().setPrincipal({
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Sari Dewi",
        email: "sari@example.com",
        role: "member",
        avatarUrl: null,
      },
      tenant: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Tenant Demo",
        subdomain: "demo",
      },
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      menus: ["dashboard", "document"],
    });

    const testFile = new File(["x".repeat(10 * 1024)], "surat-perjanjian.pdf", {
      type: "application/pdf",
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
      '[data-testid="document-card-0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01"]',
    );
    expect(docCard).not.toBeNull();

    const uploaderEl = docCard?.querySelector(
      '[data-testid="document-uploader-0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01"]',
    );
    expect(uploaderEl?.textContent).toBe("Sari Dewi");

    const dateEl = docCard?.querySelector(
      '[data-testid="document-date-0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01"]',
    );
    const expectedToday = formatDocumentDate(new Date().toISOString());
    expect(dateEl?.textContent).toBe(expectedToday);

    await cleanup();
    useAuthStore.getState().clearSession();
  });
});
