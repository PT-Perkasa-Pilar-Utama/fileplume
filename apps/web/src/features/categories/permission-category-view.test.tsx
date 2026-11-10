import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { CategoryView } from "@archiva/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CATEGORIES_QUERY_KEY, PermissionCategoryView } from "./permission-category-view.tsx";

const MOCK_CATEGORIES: CategoryView[] = [
  {
    id: "7b2f0c93-1d84-4a6e-9b52-6c7d8e9f0a1b",
    name: "REPORTING",
    isSystem: false,
    downloadActive: false,
    documentCount: 5,
    createdBy: { id: "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", name: "Sari Dewi" },
    createdAt: "2026-09-02T07:40:00.000Z",
    permissionUpdatedAt: null,
    permissionUpdatedBy: null,
  },
  {
    id: "0000aaaa-1111-4bbb-8ccc-ddddeeeeffff",
    name: "UNCATEGORIZED",
    isSystem: true,
    downloadActive: false,
    documentCount: 2,
    createdBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    permissionUpdatedAt: null,
    permissionUpdatedBy: null,
  },
];

describe("PermissionCategoryView (FE-S3-02)", () => {
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

  function setInputValue(input: HTMLInputElement, value: string): void {
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    if (valueSetter) {
      valueSetter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function renderView() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData([...CATEGORIES_QUERY_KEY, { q: "", page: 1 }], {
      data: [MOCK_CATEGORIES[1]],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    return act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <PermissionCategoryView />
        </QueryClientProvider>,
      );
    });
  }

  // AC-45.01: Menambahkan kategori baru
  test("AC-45.01: opens dialog, submits valid name, renders success alert, and invalidates list", async () => {
    fetchSpy
      // post create category
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: MOCK_CATEGORIES[0],
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      )
      // refetch list query
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: MOCK_CATEGORIES,
            meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await renderView();

    expect(container.textContent).toContain("PERMISSION CATEGORY");
    expect(container.textContent).toContain("UNCATEGORIZED");

    const addBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Tambah Kategori"),
    );
    expect(addBtn).toBeDefined();

    await act(async () => {
      addBtn?.click();
    });

    const nameInput = container.querySelector<HTMLInputElement>("#category-name");
    expect(nameInput).not.toBeNull();

    await act(async () => {
      if (nameInput) {
        setInputValue(nameInput, "Reporting");
      }
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    // Flush query invalidation refetch
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(container.textContent).toContain("Kategori berhasil ditambahkan");
    expect(container.textContent).toContain("REPORTING");
    expect(
      container.querySelector(
        `[data-testid="category-permission-status-${MOCK_CATEGORIES[0]?.id}"]`,
      )?.textContent,
    ).toBe("Inactive");
  });

  // AC-45.02: Menolak nama kategori duplikat (Negative Path)
  test("AC-45.02: preserves input value and renders error message on duplicate name 409", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "DUPLICATE_NAME",
            message: "Kategori dengan nama tersebut sudah ada",
          },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    await renderView();

    const addBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Tambah Kategori"),
    );
    await act(async () => {
      addBtn?.click();
    });

    const nameInput = container.querySelector<HTMLInputElement>("#category-name");
    await act(async () => {
      if (nameInput) {
        setInputValue(nameInput, "Reporting");
      }
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(container.textContent).toContain("Kategori dengan nama tersebut sudah ada");
    // Verify dialog is still open and input is preserved
    const nameInputAfter = container.querySelector<HTMLInputElement>("#category-name");
    expect(nameInputAfter).not.toBeNull();
    expect(nameInputAfter?.value).toBe("Reporting");
  });
});
