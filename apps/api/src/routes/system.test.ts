import { describe, expect, test } from "bun:test";
import { BASE_CONFIG, buildTestApp } from "../testing/test-app.ts";

describe("health routes", () => {
  test("liveness is public and needs no token", async () => {
    const res = await buildTestApp().request("/health/live");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", version: "test" });
  });

  test("readiness refuses an unauthenticated caller", async () => {
    // The per-dependency breakdown is reconnaissance material.
    expect((await buildTestApp().request("/health/ready")).status).toBe(401);
  });

  test("readiness refuses wrong token with 401", async () => {
    const res = await buildTestApp().request("/health/ready", {
      headers: { authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  test("readiness handles a throwing probe as down without 500 crashing", async () => {
    const app = buildTestApp(BASE_CONFIG, {
      probes: [
        {
          name: "postgres",
          canDegrade: false,
          check: async () => {
            throw new Error("connection socket abruptly severed");
          },
        },
      ],
    });
    const res = await app.request("/health/ready", {
      headers: { authorization: "Bearer dev-health-token" },
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      status: string;
      checks: Record<string, { status: string }>;
    };
    expect(body.status).toBe("down");
    expect(body.checks.postgres?.status).toBe("down");
  });

  test("readiness with the token reports per-dependency checks", async () => {
    const res = await buildTestApp().request("/health/ready", {
      headers: { authorization: "Bearer dev-health-token" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", version: "test", checks: {} });
  });

  test("readiness alias /health works identically", async () => {
    const res = await buildTestApp().request("/health", {
      headers: { authorization: "Bearer dev-health-token" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", version: "test" });
  });

  test("readiness returns 503 when a non-degradable dependency is down", async () => {
    const app = buildTestApp(BASE_CONFIG, {
      probes: [
        {
          name: "postgres",
          canDegrade: false,
          check: async () => ({ status: "down" }),
        },
      ],
    });
    const res = await app.request("/health/ready", {
      headers: { authorization: "Bearer dev-health-token" },
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("down");
  });

  test("readiness returns 200 when only a degradable dependency is down", async () => {
    const app = buildTestApp(BASE_CONFIG, {
      probes: [
        {
          name: "postgres",
          canDegrade: false,
          check: async () => ({ status: "ok" }),
        },
        {
          name: "gotenberg",
          canDegrade: true,
          check: async () => ({ status: "down" }),
        },
      ],
    });
    const res = await app.request("/health/ready", {
      headers: { authorization: "Bearer dev-health-token" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("degraded");
  });
});

describe("reset-state routes", () => {
  test("is reachable outside production and returns queued job", async () => {
    const app = buildTestApp();
    const res = await app.request("/admin/reset-state", {
      method: "POST",
      headers: { authorization: "Bearer dev-reset-token", "content-type": "application/json" },
      body: JSON.stringify({ seed: "dev", confirm: "reset-dev" }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { jobId: string; status: string; statusUrl: string };
    expect(body.status).toBe("queued");
    expect(body.statusUrl).toBe(`/admin/reset-state/${body.jobId}`);

    // Poll status of the queued job on the same app instance
    const statusRes = await app.request(body.statusUrl, {
      headers: { authorization: "Bearer dev-reset-token" },
    });
    expect(statusRes.status).toBe(200);
    const statusBody = (await statusRes.json()) as { jobId: string; status: string };
    expect(statusBody.jobId).toBe(body.jobId);
  });

  test("refuses unauthenticated reset request with 401", async () => {
    const res = await buildTestApp().request("/admin/reset-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seed: "dev", confirm: "reset-dev" }),
    });
    expect(res.status).toBe(401);
  });

  test("refuses reset request with wrong token with 401", async () => {
    const res = await buildTestApp().request("/admin/reset-state", {
      method: "POST",
      headers: { authorization: "Bearer wrong-token", "content-type": "application/json" },
      body: JSON.stringify({ seed: "dev", confirm: "reset-dev" }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  test("refuses confirm mismatch with 422", async () => {
    const res = await buildTestApp().request("/admin/reset-state", {
      method: "POST",
      headers: { authorization: "Bearer dev-reset-token", "content-type": "application/json" },
      body: JSON.stringify({ seed: "dev", confirm: "reset-wrong" }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("refuses invalid seed value with 422", async () => {
    const res = await buildTestApp().request("/admin/reset-state", {
      method: "POST",
      headers: { authorization: "Bearer dev-reset-token", "content-type": "application/json" },
      body: JSON.stringify({ seed: "invalid-seed", confirm: "reset-dev" }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("refuses missing confirm with 422", async () => {
    const res = await buildTestApp().request("/admin/reset-state", {
      method: "POST",
      headers: { authorization: "Bearer dev-reset-token", "content-type": "application/json" },
      body: JSON.stringify({ seed: "dev" }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("refuses second reset request within 1 minute with 429", async () => {
    const app = buildTestApp();

    const first = await app.request("/admin/reset-state", {
      method: "POST",
      headers: { authorization: "Bearer dev-reset-token", "content-type": "application/json" },
      body: JSON.stringify({ seed: "dev", confirm: "reset-dev" }),
    });
    expect(first.status).toBe(202);

    // Second call within 1 minute is refused by the reset-state rate limiter
    const second = await app.request("/admin/reset-state", {
      method: "POST",
      headers: { authorization: "Bearer dev-reset-token", "content-type": "application/json" },
      body: JSON.stringify({ seed: "dev", confirm: "reset-dev" }),
    });
    expect(second.status).toBe(429);
    const secondBody = (await second.json()) as { error: { code: string } };
    expect(secondBody.error.code).toBe("RATE_LIMITED");
  });

  test("refuses job status query with wrong token with 401", async () => {
    const res = await buildTestApp().request(`/admin/reset-state/${crypto.randomUUID()}`, {
      headers: { authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
  });

  test("refuses job status query with malformed UUID with 422", async () => {
    const res = await buildTestApp().request("/admin/reset-state/not-a-valid-uuid", {
      headers: { authorization: "Bearer dev-reset-token" },
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("returns 404 for unknown job id", async () => {
    const res = await buildTestApp().request(`/admin/reset-state/${crypto.randomUUID()}`, {
      headers: { authorization: "Bearer dev-reset-token" },
    });
    expect(res.status).toBe(404);
  });
});
