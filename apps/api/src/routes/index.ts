import type { CatalogService } from "@archiva/catalog";
import type { IdentityService } from "@archiva/identity";
import type { TenancyService } from "@archiva/tenancy";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../middleware/context.ts";
import { analyticsRoutes, auditRoutes } from "./activity.ts";
import { authRoutes } from "./auth.ts";
import { categoryRoutes } from "./categories.ts";
import { configurationRoutes } from "./configuration.ts";
import { createDocumentRoutes } from "./documents.ts";
import { searchRoutes } from "./search.ts";
import { storageRoutes } from "./storage.ts";
import { tagRoutes } from "./tags.ts";
import { createTenantRoutes } from "./tenants.ts";

export type RouteMountDeps = {
  tenancy: Pick<TenancyService, "createTenant" | "listTenants" | "getConfigValue" | "getQuotaUsage">;
  identity: IdentityService;
  catalog: CatalogService;
};

/** Every resource file from docs/api-specs/, mounted under /api/v1. */
export function activityRoutesMount(api: OpenAPIHono<AppEnv>, deps: RouteMountDeps): void {
  api.route("/auth", authRoutes(deps.identity));
  api.route("/tenants", createTenantRoutes(deps.tenancy));
  api.route("/configuration", configurationRoutes);
  api.route("/storage", storageRoutes(deps.tenancy));
  api.route("/documents", createDocumentRoutes(deps.catalog, deps.tenancy));
  api.route("/categories", categoryRoutes);
  api.route("/search", searchRoutes);
  api.route("/tags", tagRoutes);
  api.route("/audit-events", auditRoutes);
  api.route("/analytics", analyticsRoutes);
}
