import type { Hono } from "hono";
import type { AppEnv } from "../middleware/context.ts";
import { analyticsRoutes, auditRoutes } from "./activity.ts";
import { authRoutes } from "./auth.ts";
import { categoryRoutes } from "./categories.ts";
import { configurationRoutes, storageRoutes } from "./configuration.ts";
import { documentRoutes } from "./documents.ts";
import { searchRoutes } from "./search.ts";
import { tagRoutes } from "./tags.ts";
import { tenantRoutes } from "./tenants.ts";

/** Every resource file from docs/api-specs/, mounted under /api/v1. */
export function activityRoutesMount(api: Hono<AppEnv>) {
  api.route("/auth", authRoutes);
  api.route("/tenants", tenantRoutes);
  api.route("/configuration", configurationRoutes);
  api.route("/storage", storageRoutes);
  api.route("/documents", documentRoutes);
  api.route("/categories", categoryRoutes);
  api.route("/search", searchRoutes);
  api.route("/tags", tagRoutes);
  api.route("/audit-events", auditRoutes);
  api.route("/analytics", analyticsRoutes);
  return api;
}
