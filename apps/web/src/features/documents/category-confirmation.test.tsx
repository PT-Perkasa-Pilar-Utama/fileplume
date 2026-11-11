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
import { createRoot, type Root } from "react-dom/client";
import { DocumentCard } from "./document-card.tsx";
import { AVAILABLE_CATEGORIES_QUERY_KEY } from "./internal/category-confirmation-control.tsx";
import { MOCK_CATEGORIES, SUGGESTED_DOC } from "./internal/category-confirmation-fixtures.ts";

describe("Category Confirmation Flow (FE-S3-03, US-02, AC-02.01..AC-02.04)", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchSpy = spyOn(globalThis, "fetch");
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    fetchSpy.mockReset();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
  async function renderCardInDOM(
    doc: DocumentView,
    onCategoryConfirmed?: (documentId: string) => void,
  ) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(AVAILABLE_CATEGORIES_QUERY_KEY, MOCK_CATEGORIES);
    const rootRoute = createRootRoute();
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => <DocumentCard document={doc} onCategoryConfirmed={onCategoryConfirmed} />,
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
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );
    });
  }
  // AC-02.01: Dokumen baru tampil dengan kategori saran dan penanda "Saran"
  test("AC-02.01: shows the suggested category with the 'Saran' badge", async () => {
    await renderCardInDOM(SUGGESTED_DOC);
    const suggestionBadge = container.querySelector(
      `[data-testid="category-suggestion-badge-${SUGGESTED_DOC.id}"]`,
    );
    expect(suggestionBadge).not.toBeNull();
    expect(suggestionBadge?.textContent).toBe("Saran");
    const pickerTrigger = container.querySelector(
      `[data-testid="category-picker-trigger-${SUGGESTED_DOC.id}"]`,
    );
    expect(pickerTrigger).not.toBeNull();
    expect(pickerTrigger?.textContent).toContain("Technical Spec");
    const confirmBtn = container.querySelector(
      `[data-testid="confirm-category-btn-${SUGGESTED_DOC.id}"]`,
    );
    expect(confirmBtn).not.toBeNull();
    expect(confirmBtn?.textContent).toBe("Konfirmasi");
  });
  // AC-02.02: Tampil daftar kategori pada dokumen yang belum dikonfirmasi, saran terpilih
  test("AC-02.02: lists tenant categories with the suggestion selected", async () => {
    await renderCardInDOM(SUGGESTED_DOC);
    const pickerTrigger = container.querySelector<HTMLButtonElement>(
      `[data-testid="category-picker-trigger-${SUGGESTED_DOC.id}"]`,
    );
    expect(pickerTrigger).not.toBeNull();
    await act(async () => {
      pickerTrigger?.click();
    });
    const option1 = container.querySelector(
      `[data-testid="category-option-${MOCK_CATEGORIES[0]?.id}"]`,
    );
    const option2 = container.querySelector(
      `[data-testid="category-option-${MOCK_CATEGORIES[1]?.id}"]`,
    );
    const systemOption = container.querySelector(
      `[data-testid="category-option-${MOCK_CATEGORIES[2]?.id}"]`,
    );
    expect(option1).not.toBeNull();
    expect(option1?.textContent).toContain("Technical Spec");
    expect(option2).not.toBeNull();
    expect(option2?.textContent).toContain("Proposal");
    expect(systemOption).toBeNull();
    const checkmark = container.querySelector(
      `[data-testid="category-selected-check-${SUGGESTED_DOC.category?.id}"]`,
    );
    expect(checkmark).not.toBeNull();
  });
  // AC-02.03: Menerima kategori saran
  test("AC-02.03: confirming sends the suggested category id and triggers the callback", async () => {
    let confirmedDocId = "";
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            ...SUGGESTED_DOC,
            category: {
              ...SUGGESTED_DOC.category,
              isSuggestion: false,
            },
            metadata: null,
            versions: [],
            confirmedAt: "2026-09-02T10:00:00.000Z",
            confirmedBy: { id: "f47ac10b-58cc-4372-a567-0e02b2c3d479", name: "Budi Santoso" },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await renderCardInDOM(SUGGESTED_DOC, (id) => {
      confirmedDocId = id;
    });
    const confirmBtn = container.querySelector<HTMLButtonElement>(
      `[data-testid="confirm-category-btn-${SUGGESTED_DOC.id}"]`,
    );
    expect(confirmBtn).not.toBeNull();
    await act(async () => {
      confirmBtn?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] ?? [];
    expect(calledUrl).toBe(`/api/v1/documents/${SUGGESTED_DOC.id}/classification`);
    expect(calledInit?.method).toBe("PUT");
    expect(calledInit?.body).toBe(
      JSON.stringify({
        categoryId: "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      }),
    );
    expect(confirmedDocId).toBe(SUGGESTED_DOC.id);
  });
  // AC-02.04: Mengubah kategori saran lalu mengonfirmasi
  test("AC-02.04: selecting another category and clicking 'Konfirmasi' sends updated categoryId", async () => {
    const docWithProposalSuggestion: DocumentView = {
      ...SUGGESTED_DOC,
      category: {
        id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
        name: "Proposal",
        isSuggestion: true,
        isSystem: false,
      },
    };
    let confirmedDocId = "";
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            ...docWithProposalSuggestion,
            category: {
              id: "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
              name: "Technical Spec",
              isSuggestion: false,
              isSystem: false,
            },
            metadata: null,
            versions: [],
            confirmedAt: "2026-09-02T10:00:00.000Z",
            confirmedBy: { id: "f47ac10b-58cc-4372-a567-0e02b2c3d479", name: "Budi Santoso" },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await renderCardInDOM(docWithProposalSuggestion, (id) => {
      confirmedDocId = id;
    });
    // 1. Trigger category picker
    const pickerTrigger = container.querySelector<HTMLButtonElement>(
      `[data-testid="category-picker-trigger-${docWithProposalSuggestion.id}"]`,
    );
    await act(async () => {
      pickerTrigger?.click();
    });
    // 2. Select "Technical Spec"
    const technicalSpecOption = container.querySelector<HTMLButtonElement>(
      `[data-testid="category-option-${MOCK_CATEGORIES[0]?.id}"]`,
    );
    expect(technicalSpecOption).not.toBeNull();
    await act(async () => {
      technicalSpecOption?.click();
    });
    // Verify trigger now displays newly selected category
    expect(pickerTrigger?.textContent).toContain("Technical Spec");
    // 3. Click "Konfirmasi"
    const confirmBtn = container.querySelector<HTMLButtonElement>(
      `[data-testid="confirm-category-btn-${docWithProposalSuggestion.id}"]`,
    );
    await act(async () => {
      confirmBtn?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] ?? [];
    expect(calledUrl).toBe(`/api/v1/documents/${docWithProposalSuggestion.id}/classification`);
    expect(calledInit?.method).toBe("PUT");
    expect(calledInit?.body).toBe(
      JSON.stringify({
        categoryId: "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      }),
    );
    expect(confirmedDocId).toBe(docWithProposalSuggestion.id);
  });
});
