import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { CategoryView } from "@archiva/shared";
import { ApiError } from "../../lib/api.ts";
import { createCategoryRequest, fetchCategories } from "./api.ts";

const MOCK_CATEGORY: CategoryView = {
  id: "7b2f0c93-1d84-4a6e-9b52-6c7d8e9f0a1b",
  name: "Reporting",
  isSystem: false,
  downloadActive: false,
  documentCount: 0,
  createdBy: { id: "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", name: "Sari Dewi" },
  createdAt: "2026-09-02T07:40:00.000Z",
  permissionUpdatedAt: null,
  permissionUpdatedBy: null,
};

describe("categories api client (FE-S3-02)", () => {
  const fetchSpy = spyOn(globalThis, "fetch");

  afterEach(() => {
    fetchSpy.mockReset();
  });

  // AC-45.01: GET /api/v1/categories
  test("fetchCategories requests /api/v1/categories with params and parses collection", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [MOCK_CATEGORY],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await fetchCategories({ page: 1, limit: 10, q: "rep" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0]?.[0];
    expect(calledUrl).toBe("/api/v1/categories?page=1&limit=10&q=rep");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.name).toBe("Reporting");
    expect(result.meta.total).toBe(1);
  });

  // AC-45.01: POST /api/v1/categories success
  test("createCategoryRequest posts JSON body and parses CategoryView response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: MOCK_CATEGORY }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await createCategoryRequest({ name: "Reporting" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] ?? [];
    expect(calledUrl).toBe("/api/v1/categories");
    expect(calledInit?.method).toBe("POST");
    expect(JSON.parse(calledInit?.body as string)).toEqual({ name: "Reporting" });
    expect(result.id).toBe(MOCK_CATEGORY.id);
    expect(result.downloadActive).toBe(false);
  });

  // AC-45.02: Conflict 409 DUPLICATE_NAME
  test("createCategoryRequest throws ApiError when category name already exists", async () => {
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

    try {
      await createCategoryRequest({ name: "Reporting" });
      expect().fail("should have thrown ApiError");
    } catch (err: unknown) {
      expect(err instanceof ApiError).toBe(true);
      if (err instanceof ApiError) {
        expect(err.status).toBe(409);
        expect(err.code).toBe("DUPLICATE_NAME");
        expect(err.message).toBe("Kategori dengan nama tersebut sudah ada");
      }
    }
  });
});
