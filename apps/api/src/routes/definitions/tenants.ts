import {
  collectionOf,
  createTenantBody,
  dataOf,
  listTenantsQuery,
  setQuotaBody,
  tenantIdParams,
  tenantListItemSchema,
  tenantSchema,
} from "@archiva/shared";
import { createRoute } from "@hono/zod-openapi";
import { requireRole } from "../../middleware/guards.ts";
import { ERROR_404, ERROR_409, ERROR_422, GUARDED, json, jsonBody, SESSION } from "./responses.ts";

const tags = ["Tenants"];
const middleware = requireRole("super_admin");

/** api-specs/03-tenants.md 3.1. Served on the reserved `admin` subdomain. */
export const createTenant = createRoute({
  method: "post",
  path: "/",
  tags,
  summary: "Create a tenant and its reserved Uncategorized category",
  security: SESSION,
  middleware,
  request: { body: jsonBody(createTenantBody) },
  responses: {
    201: json(dataOf(tenantSchema), "Tenant created"),
    ...GUARDED,
    ...ERROR_409,
    ...ERROR_422,
  },
});

/** 3.2. */
export const listTenants = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List tenants with quota figures",
  security: SESSION,
  middleware,
  request: { query: listTenantsQuery },
  responses: {
    200: json(collectionOf(tenantListItemSchema), "A page of tenants"),
    ...GUARDED,
    ...ERROR_422,
  },
});

/** 3.3. The only write path for `storage_quota_gb`. */
export const setTenantQuota = createRoute({
  method: "patch",
  path: "/{tenantId}/quota",
  tags,
  summary: "Set a tenant's storage quota",
  security: SESSION,
  middleware,
  request: { params: tenantIdParams, body: jsonBody(setQuotaBody) },
  responses: {
    200: json(dataOf(tenantListItemSchema), "The updated tenant"),
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_422,
  },
});
