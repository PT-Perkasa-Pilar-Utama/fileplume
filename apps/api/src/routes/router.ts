import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../middleware/context.ts";
import { validationHook } from "../middleware/errors.ts";

/**
 * Every router validates through one hook, so a refused request is always the
 * VALIDATION_ERROR envelope of api-specs/01-conventions.md 1.6. Route
 * middleware runs before the validators, so a role floor refuses first (1.12).
 */
export function createRouter(): OpenAPIHono<AppEnv> {
  return new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
}
