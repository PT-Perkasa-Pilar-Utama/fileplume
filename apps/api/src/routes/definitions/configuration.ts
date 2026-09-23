import {
  collectionOf,
  configKeyParams,
  configParameterSchema,
  dataOf,
  setConfigValueBody,
  storageSchema,
} from "@archiva/shared";
import { createRoute } from "@hono/zod-openapi";
import { requireConfigRole, requireRole } from "../../middleware/guards.ts";
import { ERROR_422, GUARDED, json, jsonBody, SESSION } from "./responses.ts";

const tags = ["Configuration"];

/** api-specs/04-configuration.md 4.2. A fixed list of three. */
export const listConfiguration = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "Read every parameter in the closed key set",
  security: SESSION,
  middleware: requireRole("admin_tenant"),
  responses: { 200: json(collectionOf(configParameterSchema), "All parameters"), ...GUARDED },
});

/** 4.3. `storage_quota_gb` answers NOT_EDITABLE_BY_TENANT before any role check. */
export const setConfigValue = createRoute({
  method: "patch",
  path: "/{key}",
  tags,
  summary: "Change one operating parameter",
  security: SESSION,
  middleware: requireConfigRole(),
  request: { params: configKeyParams, body: jsonBody(setConfigValueBody) },
  responses: {
    200: json(dataOf(configParameterSchema), "The updated parameter"),
    ...GUARDED,
    ...ERROR_422,
  },
});

/** 4.4. Idempotent: the post-state is "at its default" either way. */
export const resetConfigValue = createRoute({
  method: "delete",
  path: "/{key}",
  tags,
  summary: "Return one parameter to its default",
  security: SESSION,
  middleware: requireConfigRole(),
  request: { params: configKeyParams },
  responses: {
    200: json(dataOf(configParameterSchema), "The parameter at its default"),
    ...GUARDED,
    ...ERROR_422,
  },
});

/** 4.5. Committed usage, not usage plus outstanding reservations. */
export const getStorage = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "Read the storage capacity indicator",
  security: SESSION,
  middleware: requireRole("member"),
  responses: { 200: json(dataOf(storageSchema), "Storage usage and level"), ...GUARDED },
});
