import { describe, expect, test } from "bun:test";
import { SESSION_COOKIE_NAME } from "@archiva/identity";
import type { PrincipalView, Session } from "@archiva/shared";
import { buildTestApp, errorOf, TENANT_A, TOKENS, tenantRequest } from "../testing/test-app.ts";

describe("POST /auth/login", () => {
  // AC-40.01: Login dengan kredensial yang valid
  test("successful login returns 200, user profile, tenant, and sets __Host- cookie", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "budi@contohbaru.co.id", password: "secret" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = ((await res.json()) as { data: Session }).data;

    expect(body.user.email).toBe("budi@contohbaru.co.id");
    expect(body.user.name).toBe("Budi Santoso");
    expect(body.user.role).toBe("member");
    expect(body.user.avatarUrl).toBeNull();
    expect(body.tenant).toEqual({
      id: TENANT_A.id,
      name: TENANT_A.name,
      subdomain: TENANT_A.subdomain,
    });
    expect(body.expiresAt).toBeDefined();

    // Check Set-Cookie header (api-specs/02-authentication.md 2.1)
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    // __Host- cookie MUST NOT have Domain attribute
    expect(setCookie?.toLowerCase()).not.toContain("domain=");
  });

  // AC-40.01: Super Admin login on admin subdomain
  test("super_admin login on admin host returns tenant null", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/auth/login", {
        subdomain: "admin",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "superadmin@archiva.id", password: "admin-secret" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = ((await res.json()) as { data: Session }).data;
    expect(body.user.role).toBe("super_admin");
    expect(body.tenant).toBeNull();
  });

  // AC-40.02: Login dengan kredensial yang salah (Negative Path)
  test("wrong password returns 401 INVALID_CREDENTIALS with exact Indonesian copy", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "budi@contohbaru.co.id", password: "wrong-password" }),
      }),
    );

    expect(res.status).toBe(401);
    expect(await errorOf(res)).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "Email atau password salah",
    });
  });

  // AC-40.02: Unknown email returns identical 401 INVALID_CREDENTIALS
  test("unknown email returns 401 INVALID_CREDENTIALS with exact Indonesian copy", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "tidak-ada@contohbaru.co.id", password: "secret" }),
      }),
    );

    expect(res.status).toBe(401);
    expect(await errorOf(res)).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "Email atau password salah",
    });
  });

  // AC-40.02: User of another tenant attempting to log in on Tenant A subdomain returns INVALID_CREDENTIALS
  test("cross-tenant login returns 401 INVALID_CREDENTIALS without leaking account existence", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "userb@mitra-rahasia.co.id", password: "secret" }),
      }),
    );

    expect(res.status).toBe(401);
    expect(await errorOf(res)).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "Email atau password salah",
    });
  });

  // Validation failure
  test("missing or malformed email returns 422 VALIDATION_ERROR", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "not-an-email", password: "secret" }),
      }),
    );

    expect(res.status).toBe(422);
    expect((await errorOf(res)).code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /auth/logout", () => {
  // AC-40.03: Logout dari sistem
  test("logout ends the session, clears cookie, and returns 204", async () => {
    const app = buildTestApp();

    // Verify session works before logout
    const preRes = await app.request(tenantRequest("/auth/me", { token: TOKENS.memberA }));
    expect(preRes.status).toBe(200);

    // Call logout
    const logoutRes = await app.request(
      tenantRequest("/auth/logout", {
        method: "POST",
        token: TOKENS.memberA,
      }),
    );

    expect(logoutRes.status).toBe(204);

    // Verify cookie was cleared
    const setCookie = logoutRes.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("Max-Age=0");

    // Calling me afterwards returns 401 SESSION_EXPIRED
    const postRes = await app.request(tenantRequest("/auth/me", { token: TOKENS.memberA }));
    expect(postRes.status).toBe(401);
    expect((await errorOf(postRes)).code).toBe("SESSION_EXPIRED");
  });

  // api-specs/02-authentication.md 2.3: Idempotency
  test("calling logout without a cookie or twice still returns 204", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/auth/logout", {
        method: "POST",
      }),
    );
    expect(res.status).toBe(204);
  });
});

describe("GET /auth/me", () => {
  // AC-40.01: Informasi profil ditampilkan
  test("me returns profile of the authenticated user", async () => {
    const app = buildTestApp();
    const res = await app.request(tenantRequest("/auth/me", { token: TOKENS.memberA }));

    expect(res.status).toBe(200);
    const body = ((await res.json()) as { data: PrincipalView }).data;

    expect(body.user.role).toBe("member");
    expect(body.tenant?.subdomain).toBe(TENANT_A.subdomain);
    expect(body.menus).toEqual(["dashboard", "document"]);
  });

  // Super admin session on admin host (api-specs/02-authentication.md 2.4)
  test("super_admin session on admin host returns tenant null and tenant_management menu", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/auth/me", { subdomain: "admin", token: TOKENS.superAdmin }),
    );
    expect(res.status).toBe(200);
    const body = ((await res.json()) as { data: PrincipalView }).data;
    expect(body.user.role).toBe("super_admin");
    expect(body.tenant).toBeNull();
    expect(body.menus).toEqual(["tenant_management"]);
  });

  // Tenant scope: Cross-tenant session returns 404, not 403 (CLAUDE.md 5.3)
  test("cross-tenant session returns 404 NOT_FOUND", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/auth/me", { subdomain: TENANT_A.subdomain, token: TOKENS.memberB }),
    );
    expect(res.status).toBe(404);
    expect((await errorOf(res)).code).toBe("NOT_FOUND");
  });

  // AC-40.04: Sesi berakhir karena tidak aktif
  test("idle-expired session returns 401 SESSION_EXPIRED with exact copy", async () => {
    const app = buildTestApp();
    const res = await app.request(tenantRequest("/auth/me", { token: TOKENS.idleA }));

    expect(res.status).toBe(401);
    expect(await errorOf(res)).toEqual({
      code: "SESSION_EXPIRED",
      message: "Sesi Anda telah berakhir. Silakan login kembali",
    });
  });

  test("unauthenticated request returns 401 UNAUTHENTICATED with exact copy", async () => {
    const app = buildTestApp();
    const res = await app.request(tenantRequest("/auth/me"));

    expect(res.status).toBe(401);
    expect(await errorOf(res)).toEqual({
      code: "UNAUTHENTICATED",
      message: "Sesi Anda telah berakhir. Silakan login kembali",
    });
  });
});
