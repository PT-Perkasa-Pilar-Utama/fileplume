import {
  type CategoryNameBody,
  type CategoryView,
  categorySchema,
  collectionOf,
  dataOf,
  type Meta,
} from "@archiva/shared";
import { apiFetch } from "../../lib/api.ts";

export interface ListCategoriesParams {
  readonly page?: number;
  readonly limit?: number;
  readonly sort?: "name" | "createdAt" | "documentCount";
  readonly order?: "asc" | "desc";
  readonly q?: string;
}

export interface ListCategoriesResponse {
  readonly data: CategoryView[];
  readonly meta: Meta;
}

/**
 * GET /api/v1/categories
 * api-specs/06-categories.md 6.2
 */
export async function fetchCategories(
  params?: ListCategoriesParams,
): Promise<ListCategoriesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page !== undefined) searchParams.set("page", String(params.page));
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params?.sort) searchParams.set("sort", params.sort);
  if (params?.order) searchParams.set("order", params.order);
  if (params?.q) searchParams.set("q", params.q);

  const queryString = searchParams.toString();
  const path = queryString ? `/categories?${queryString}` : "/categories";

  return apiFetch(path, collectionOf(categorySchema));
}

/**
 * POST /api/v1/categories
 * api-specs/06-categories.md 6.3
 */
export async function createCategoryRequest(input: CategoryNameBody): Promise<CategoryView> {
  const response = await apiFetch("/categories", dataOf(categorySchema), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.data;
}
