import { describe, expect, test } from "bun:test";
import type { Config } from "@archiva/config";
import { createApp } from "./app.ts";

const base: Config = {
  APP_ENV: "dev",
  NODE_ENV: "development",
  PORT: 3000,
  LOG_LEVEL: "debug",
  WEB_ORIGIN: "http://localhost:5173",
  APP_VERSION: "test",
  DATABASE_URL: "postgres://x@localhost:5432/x",
  DATABASE_POOL_MAX: 10,
  VALKEY_URL: "redis://localhost:6379",
  OPENSEARCH_URL: "http://localhost:9200",
  OPENSEARCH_USERNAME: "admin",
  OPENSEARCH_PASSWORD: "x",
  OPENSEARCH_INDEX_PREFIX: "archiva-test",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "archiva",
  S3_ACCESS_KEY_ID: "x",
  S3_SECRET_ACCESS_KEY: "x",
  S3_FORCE_PATH_STYLE: true,
  CLAMAV_HOST: "localhost",
  CLAMAV_PORT: 3310,
  GOTENBERG_URL: "http://localhost:3001",
  AI_PROVIDER: "stub",
  AI_MODEL_CLASSIFY: "claude-sonnet-5",
  AI_MODEL_TAG: "claude-haiku-4-5-20251001",
  AI_DAILY_TOKEN_BUDGET: 1000,
  OCR_PROVIDER: "fixture",
  AUTH_SECRET: "0123456789012345678901234567890123",
  SESSION_ABSOLUTE_TTL_DAYS: 30,
  SESSION_IDLE_TTL_HOURS: 8,
  ENABLE_RESET_API: true,
  RESET_API_TOKEN: "dev-reset-token",
  RESET_DEFAULT_SEED: "dev",
  HEALTH_TOKEN: "dev-health-token",
  WORKER_CONCURRENCY: 4,
  WORKER_MAX_ATTEMPTS: 3,
  WORKER_BACKOFF_MS: 5000,
} as Config;

const productionConfig: Config = {
  ...base,
  APP_ENV: "production",
  ENABLE_RESET_API: undefined,
  RESET_API_TOKEN: undefined,
  RESET_DEFAULT_SEED: undefined,
} as Config;

describe("reset-state route registration", () => {
  test("is reachable outside production", async () => {
    const app = createApp(base);
    const res = await app.request("/admin/reset-state", {
      method: "POST",
      headers: { authorization: "Bearer dev-reset-token", "content-type": "application/json" },
      body: JSON.stringify({ seed: "dev", confirm: "reset-dev" }),
    });
    expect(res.status).toBe(202);
  });

  test("a production build returns 404, indistinguishable from an unknown path", async () => {
    // technical-specs/07-security.md 7.6.2 layer 3. This is the assertion that
    // holds the line: the rule is only real if a test fails when someone breaks it.
    const app = createApp(productionConfig);
    const res = await app.request("/admin/reset-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seed: "dev", confirm: "reset-production" }),
    });
    expect(res.status).toBe(404);
  });

  test("a production build 404s the job status route too", async () => {
    const app = createApp(productionConfig);
    const res = await app.request("/admin/reset-state/abc");
    expect(res.status).toBe(404);
  });
});

describe("health monitor", () => {
  test("liveness is public and needs no token", async () => {
    const app = createApp(base);
    const res = await app.request("/health/live");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", version: "test" });
  });

  test("readiness refuses an unauthenticated caller", async () => {
    // The per-dependency breakdown is reconnaissance material.
    const app = createApp(base);
    expect((await app.request("/health/ready")).status).toBe(401);
  });

  test("readiness with the token reports per-dependency checks", async () => {
    const app = createApp(base, []);
    const res = await app.request("/health/ready", {
      headers: { authorization: "Bearer dev-health-token" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", version: "test", checks: {} });
  });
});

describe("stubbed endpoints return contract-valid shapes", () => {
  const app = createApp(base);

  test("a collection carries data and meta", async () => {
    const res = await app.request("/api/v1/documents");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; meta: { total: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.meta.total).toBe("number");
  });

  test("a single resource carries data", async () => {
    const res = await app.request("/api/v1/auth/me");
    const body = (await res.json()) as { data: { menus: string[] } };
    expect(body.data.menus).toContain("dashboard");
  });

  test("a member is refused an admin route with 403", async () => {
    // AC-41.05: the server refuses regardless of what the menu shows.
    const res = await app.request("/api/v1/configuration");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toBe("Anda tidak memiliki akses ke halaman ini");
  });

  test("an unknown path is 404", async () => {
    expect((await app.request("/api/v1/nope")).status).toBe(404);
  });
});
