import {
  collectionOf,
  contentHitSchema,
  contentSearchQuery,
  titleHitSchema,
  titleSearchQuery,
  topTagSchema,
  topTagsQuery,
} from "@archiva/shared";
import { createRoute } from "@hono/zod-openapi";
import { requireRole } from "../../middleware/guards.ts";
import { ERROR_422, ERROR_429, ERROR_503, GUARDED, json, SESSION } from "./responses.ts";

/** api-specs/08-search.md 8.2. */
export const searchTitles = createRoute({
  method: "get",
  path: "/titles",
  tags: ["Search"],
  summary: "Search titles and metadata",
  security: SESSION,
  middleware: requireRole("member"),
  request: { query: titleSearchQuery },
  responses: {
    200: json(collectionOf(titleHitSchema), "One hit per document"),
    ...GUARDED,
    ...ERROR_422,
    ...ERROR_429,
    ...ERROR_503,
  },
});

/** 8.3. Collapsed to the best-scoring page per document. */
export const searchContent = createRoute({
  method: "get",
  path: "/content",
  tags: ["Search"],
  summary: "Deep content search, with the page each match is on",
  security: SESSION,
  middleware: requireRole("member"),
  request: { query: contentSearchQuery },
  responses: {
    200: json(collectionOf(contentHitSchema), "One hit per document"),
    ...GUARDED,
    ...ERROR_422,
    ...ERROR_429,
    ...ERROR_503,
  },
});

/** api-specs/07-enrichment.md 7.7. Ties break on `tag` ascending. */
export const listTopTags = createRoute({
  method: "get",
  path: "/top",
  tags: ["Enrichment"],
  summary: "The Top Tags filter panel",
  security: SESSION,
  middleware: requireRole("member"),
  request: { query: topTagsQuery },
  responses: {
    200: json(collectionOf(topTagSchema), "Tags by document count"),
    ...GUARDED,
    ...ERROR_422,
  },
});
