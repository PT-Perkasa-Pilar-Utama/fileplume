import type { Context } from "hono";

/**
 * `POST /documents` and `POST /documents/:id/versions`, the two multipart
 * operations in api-specs/01-conventions.md 1.2. They stream past the JSON
 * body limit and carry their own per-user rate limit.
 */
const UPLOAD_PATH = /^\/api\/v1\/documents(?:\/[^/]+\/versions)?\/?$/;

export function isUploadRequest(c: Context): boolean {
  return c.req.method === "POST" && UPLOAD_PATH.test(c.req.path);
}
