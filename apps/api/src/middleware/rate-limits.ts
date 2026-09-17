import type { Context, Hono, MiddlewareHandler } from "hono";
import { getConnInfo } from "hono/bun";
import { rateLimiter, type Store } from "hono-rate-limiter";
import { z } from "zod";
import type { AppEnv } from "./context.ts";
import { fail } from "./errors.ts";
import { isUploadRequest } from "./internal/upload-routes.ts";

/** One store per limiter, so each keeps its own window. Valkey in production, memory in tests. */
export type RateLimitStoreFactory = (name: string) => Store<AppEnv>;

type KeyOf = (c: Context<AppEnv>) => string | null | Promise<string | null>;

type LimitSpec = { name: string; windowMs: number; limit: number; key: KeyOf };

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const loginBody = z.object({ email: z.string().min(1) });

function limiter(spec: LimitSpec, stores: RateLimitStoreFactory): MiddlewareHandler<AppEnv> {
  return rateLimiter<AppEnv>({
    windowMs: spec.windowMs,
    limit: spec.limit,
    store: stores(spec.name),
    standardHeaders: "draft-6",
    skip: async (c) => (await spec.key(c)) === null,
    keyGenerator: async (c) => (await spec.key(c)) ?? "",
    handler: (c) => fail(c, "RATE_LIMITED"),
  });
}

/** Caddy is the only ingress and sets X-Forwarded-For; a direct connection uses the socket. */
function clientIp(c: Context<AppEnv>): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  if (c.env && typeof c.env === "object" && "server" in c.env) {
    return getConnInfo(c).remote.address ?? "unknown";
  }
  return "unknown";
}

async function loginEmail(c: Context<AppEnv>): Promise<string | null> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    // Malformed JSON is the route validator's to refuse. The per-IP login
    // limit has already counted this request, so nothing escapes a limit.
    return null;
  }
  const parsed = loginBody.safeParse(body);
  return parsed.success ? parsed.data.email.toLowerCase() : null;
}

function sessionId(c: Context<AppEnv>): string | null {
  const session = c.get("session");
  return session.kind === "authenticated" ? session.principal.sessionId : null;
}

function uploader(c: Context<AppEnv>): string | null {
  const session = c.get("session");
  if (!isUploadRequest(c) || session.kind !== "authenticated") return null;
  return session.principal.userId;
}

/**
 * api-specs/01-conventions.md 1.10. Mounted after request context, so search
 * and upload are keyed on the resolved session. An unauthenticated request
 * is skipped here and refused by the route's floor.
 */
export function mountRateLimits(api: Hono<AppEnv>, stores: RateLimitStoreFactory): void {
  api.post(
    "/auth/login",
    limiter({ name: "login-ip", windowMs: MINUTE_MS, limit: 5, key: clientIp }, stores),
    limiter({ name: "login-email", windowMs: MINUTE_MS, limit: 5, key: loginEmail }, stores),
  );
  api.use(
    "/search/*",
    limiter({ name: "search", windowMs: MINUTE_MS, limit: 60, key: sessionId }, stores),
  );
  api.use("*", limiter({ name: "upload", windowMs: HOUR_MS, limit: 100, key: uploader }, stores));
}

export function resetStateLimit(stores: RateLimitStoreFactory): MiddlewareHandler<AppEnv> {
  return limiter({ name: "reset-state", windowMs: MINUTE_MS, limit: 1, key: () => "all" }, stores);
}
