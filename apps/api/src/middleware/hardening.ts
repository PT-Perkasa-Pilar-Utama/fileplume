import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv } from "./context.ts";
import { fail } from "./errors.ts";
import { isUploadRequest } from "./internal/upload-routes.ts";

export const JSON_BODY_LIMIT_BYTES = 1024 * 1024;

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** technical-specs/07-security.md 7.4. The same values the Caddyfile sets, so either layer holds alone. */
export function securityHeaders(): MiddlewareHandler<AppEnv> {
  return secureHeaders({
    strictTransportSecurity: "max-age=31536000; includeSubDomains; preload",
    xContentTypeOptions: "nosniff",
    xFrameOptions: "DENY",
    referrerPolicy: "strict-origin-when-cross-origin",
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "blob:", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  });
}

function isSameOrigin(origin: string, requestUrl: string): boolean {
  return URL.parse(origin)?.host === new URL(requestUrl).host;
}

/**
 * 7.4 CSRF: SameSite=Lax covers navigations, this covers a forged fetch. The
 * SPA is served from each tenant's own host (Caddyfile), so same-origin is
 * accepted beside WEB_ORIGIN; no foreign page can claim either. A refusal here
 * writes no audit row: no session has been read yet, so there is no principal
 * or tenant to record it against (api-specs/01-conventions.md 1.13).
 */
export function originCheck(webOrigin: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!MUTATING_METHODS.has(c.req.method)) return next();
    const origin = c.req.header("origin");
    if (origin !== undefined && (origin === webOrigin || isSameOrigin(origin, c.req.url))) {
      return next();
    }
    return fail(c, "FORBIDDEN");
  };
}

/** 7.4: 1 MB for JSON. Uploads stream past it, bounded by the tenant's `max_file_size_mb`. */
export function jsonBodyLimit(): MiddlewareHandler<AppEnv> {
  const limit = bodyLimit({
    maxSize: JSON_BODY_LIMIT_BYTES,
    onError: (c) => fail(c, "PAYLOAD_TOO_LARGE"),
  });
  return async (c, next) => (isUploadRequest(c) ? next() : limit(c, next));
}
