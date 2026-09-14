import { join } from "node:path";
import { SESSION_COOKIE_NAME } from "@archiva/identity";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "./middleware/context.ts";

/** Committed beside the app; openapi.test.ts fails when it drifts from the routes. */
export const OPENAPI_PATH = join(import.meta.dir, "..", "openapi.json");

/** api-specs/01-conventions.md 1.3 and 10-system.md 10.1. */
export function registerSecuritySchemes(app: OpenAPIHono<AppEnv>): void {
  app.openAPIRegistry.registerComponent("securitySchemes", "session", {
    type: "apiKey",
    in: "cookie",
    name: SESSION_COOKIE_NAME,
  });
  app.openAPIRegistry.registerComponent("securitySchemes", "healthToken", {
    type: "http",
    scheme: "bearer",
  });
  app.openAPIRegistry.registerComponent("securitySchemes", "resetToken", {
    type: "http",
    scheme: "bearer",
  });
}

/**
 * The machine-readable companion to docs/api-specs/, generated from the same
 * Zod schemas the handlers validate against (api-specs/_index.md).
 */
export function openApiDocument(
  app: OpenAPIHono<AppEnv>,
): ReturnType<OpenAPIHono<AppEnv>["getOpenAPI31Document"]> {
  return app.getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: "Archiva API", version: "1.0" },
  });
}
