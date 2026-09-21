import {
  collectionOf,
  dataOf,
  type Meta,
  type TenantListItem,
  type TenantView,
  tenantListItemSchema,
  tenantSchema,
} from "@archiva/shared";
import { apiFetch } from "../../lib/api.ts";
import type { CreateTenantFormInput } from "./types.ts";

export interface ListTenantsParams {
  page?: number;
  limit?: number;
  sort?: "createdAt" | "name" | "storageUsedBytes";
  order?: "asc" | "desc";
  q?: string;
}

export interface ListTenantsResponse {
  data: TenantListItem[];
  meta: Meta;
}

/**
 * GET /api/v1/tenants
 * api-specs/03-tenants.md 3.2
 */
export async function fetchTenants(params?: ListTenantsParams): Promise<ListTenantsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.sort) searchParams.set("sort", params.sort);
  if (params?.order) searchParams.set("order", params.order);
  if (params?.q) searchParams.set("q", params.q);

  const queryString = searchParams.toString();
  const path = queryString ? `/tenants?${queryString}` : "/tenants";

  return apiFetch(path, collectionOf(tenantListItemSchema));
}

/**
 * POST /api/v1/tenants
 * api-specs/03-tenants.md 3.1
 */
export async function createTenantRequest(input: CreateTenantFormInput): Promise<TenantView> {
  const response = await apiFetch("/tenants", dataOf(tenantSchema), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.data;
}
