import { describe, expect, test } from "bun:test";
import type { Config } from "@archiva/config";
import { BASE_CONFIG, buildTestApp, errorOf, TOKENS, tenantRequest } from "./testing/test-app.ts";

const productionConfig: Config = {
  ...BASE_CONFIG,
  APP_ENV: "production",
  ENABLE_RESET_API: undefined,
  RESET_API_TOKEN: undefined,
  RESET_DEFAULT_SEED: undefined,
};

describe("reset-state route registration", () => {
  test("is reachable outside production", async () => {
    const res = await buildTestApp().request("/admin/reset-state", {
      method: "POST",
      headers: { authorization: "Bearer dev-reset-token", "content-type": "application/json" },
      body: JSON.stringify({ seed: "dev", confirm: "reset-dev" }),
    });
    expect(res.status).toBe(202);
  });

  test("a production build returns 404, indistinguishable from an unknown path", async () => {
    // technical-specs/07-security.md 7.6.2 layer 3. This is the assertion that
    // holds the line: the rule is only real if a test fails when someone breaks it.
    const app = buildTestApp(productionConfig);
    const res = await app.request("/admin/reset-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seed: "dev", confirm: "reset-production" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(await (await app.request("/definitely-unknown")).json());
  });

  test("a production build 404s the job status route too", async () => {
    const res = await buildTestApp(productionConfig).request("/admin/reset-state/abc");
    expect(res.status).toBe(404);
  });
});

describe("health monitor", () => {
  test("liveness is public and needs no token", async () => {
    const res = await buildTestApp().request("/health/live");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", version: "test" });
  });

  test("readiness refuses an unauthenticated caller", async () => {
    // The per-dependency breakdown is reconnaissance material.
    expect((await buildTestApp().request("/health/ready")).status).toBe(401);
  });

  test("readiness with the token reports per-dependency checks", async () => {
    const res = await buildTestApp().request("/health/ready", {
      headers: { authorization: "Bearer dev-health-token" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", version: "test", checks: {} });
  });
});

describe("stubbed endpoints return contract-valid shapes", () => {
  const app = buildTestApp();

  test("a collection carries data and meta", async () => {
    const res = await app.request(tenantRequest("/documents", { token: TOKENS.memberA }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; meta: { total: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.meta.total).toBe("number");
  });

  test("a single resource carries data", async () => {
    const res = await app.request(tenantRequest("/auth/me", { token: TOKENS.memberA }));
    const body = (await res.json()) as { data: { menus: string[] } };
    expect(body.data.menus).toContain("dashboard");
  });

  test("a member is refused an admin route with 403", async () => {
    // AC-41.05: the server refuses regardless of what the menu shows.
    const res = await app.request(tenantRequest("/configuration", { token: TOKENS.memberA }));
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toEqual({
      code: "FORBIDDEN",
      message: "Anda tidak memiliki akses ke halaman ini",
    });
  });

  test("an unknown path inside a tenant is 404", async () => {
    const res = await app.request(tenantRequest("/nope", { token: TOKENS.memberA }));
    expect(res.status).toBe(404);
  });
});
