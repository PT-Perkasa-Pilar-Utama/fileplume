import { describe, expect, test } from "bun:test";
import { BASE_CONFIG, buildTestApp, errorOf, TOKENS, tenantRequest } from "../testing/test-app.ts";
import { JSON_BODY_LIMIT_BYTES } from "./hardening.ts";

const newCategory = (origin?: string | null) =>
  tenantRequest("/categories", {
    method: "POST",
    token: TOKENS.adminA,
    origin,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Legal" }),
  });

describe("security headers", () => {
  test("every response carries the 7.4 headers", async () => {
    const res = await buildTestApp().request("/health/live");
    expect(res.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'self'; img-src 'self' blob: data:; object-src 'none'; frame-ancestors 'none'",
    );
  });

  test("CORS names WEB_ORIGIN with credentials, never a wildcard", async () => {
    const res = await buildTestApp().request(
      tenantRequest("/documents", {
        method: "OPTIONS",
        headers: { "access-control-request-method": "POST" },
      }),
    );
    expect(res.headers.get("access-control-allow-origin")).toBe(BASE_CONFIG.WEB_ORIGIN);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });
});

describe("origin check on mutating requests", () => {
  test("a foreign origin is refused with 403", async () => {
    const res = await buildTestApp().request(newCategory("https://evil.example"));
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toEqual({
      code: "FORBIDDEN",
      message: "Anda tidak memiliki akses ke halaman ini",
    });
  });

  test("a missing origin is refused", async () => {
    expect((await buildTestApp().request(newCategory(null))).status).toBe(403);
  });

  test("WEB_ORIGIN is accepted", async () => {
    expect((await buildTestApp().request(newCategory(BASE_CONFIG.WEB_ORIGIN))).status).toBe(201);
  });

  test("the tenant's own origin is accepted", async () => {
    expect((await buildTestApp().request(newCategory("http://contohbaru.localhost"))).status).toBe(
      201,
    );
  });

  test("a read is not origin-checked", async () => {
    const res = await buildTestApp().request(
      tenantRequest("/documents", {
        token: TOKENS.memberA,
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe("body limit", () => {
  test("a JSON body over 1 MB is PAYLOAD_TOO_LARGE", async () => {
    const res = await buildTestApp().request(
      tenantRequest("/categories", {
        method: "POST",
        token: TOKENS.adminA,
        headers: { "content-type": "application/json" },
        body: "x".repeat(JSON_BODY_LIMIT_BYTES + 1),
      }),
    );
    expect(res.status).toBe(413);
    expect(await errorOf(res)).toEqual({
      code: "PAYLOAD_TOO_LARGE",
      message: "Ukuran permintaan terlalu besar",
    });
  });

  test("an upload streams past the JSON limit", async () => {
    const res = await buildTestApp().request(
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        headers: { "content-type": "multipart/form-data; boundary=x" },
        body: "x".repeat(JSON_BODY_LIMIT_BYTES + 1),
      }),
    );
    expect(res.status).toBe(201);
  });
});
