import {
  categoryNameBody,
  categorySchema,
  collectionOf,
  dataOf,
  downloadPermissionBody,
  idParams,
  listCategoriesQuery,
} from "@archiva/shared";
import { createRoute } from "@hono/zod-openapi";
import { requireRole } from "../../middleware/guards.ts";
import { ERROR_404, ERROR_409, ERROR_422, GUARDED, json, jsonBody, SESSION } from "./responses.ts";

const tags = ["Categories"];

/** api-specs/06-categories.md 6.2. The taxonomy is not secret. */
export const listCategories = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List the tenant's categories and their download permission",
  security: SESSION,
  middleware: requireRole("member"),
  request: { query: listCategoriesQuery },
  responses: {
    200: json(collectionOf(categorySchema), "A page of categories"),
    ...GUARDED,
    ...ERROR_422,
  },
});

/** 6.3. A new category's download permission always starts Inactive. */
export const createCategory = createRoute({
  method: "post",
  path: "/",
  tags,
  summary: "Add a category",
  security: SESSION,
  middleware: requireRole("head_of_team"),
  request: { body: jsonBody(categoryNameBody) },
  responses: {
    201: json(dataOf(categorySchema), "Category created, Inactive"),
    ...GUARDED,
    ...ERROR_409,
    ...ERROR_422,
  },
});

/** 6.4. The reserved row cannot be renamed. */
export const renameCategory = createRoute({
  method: "patch",
  path: "/{id}",
  tags,
  summary: "Rename a category",
  security: SESSION,
  middleware: requireRole("head_of_team"),
  request: { params: idParams, body: jsonBody(categoryNameBody) },
  responses: {
    200: json(dataOf(categorySchema), "The renamed category"),
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_409,
    ...ERROR_422,
  },
});

/** 6.5. Effective on the next request; no cache in front of the predicate. */
export const setDownloadPermission = createRoute({
  method: "put",
  path: "/{id}/download-permission",
  tags,
  summary: "Turn download on or off for a category",
  security: SESSION,
  middleware: requireRole("head_of_team"),
  request: { params: idParams, body: jsonBody(downloadPermissionBody) },
  responses: {
    200: json(dataOf(categorySchema), "The updated category"),
    ...GUARDED,
    ...ERROR_404,
    ...ERROR_422,
  },
});
