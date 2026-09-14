import { describe, expect, test } from "bun:test";
import { buildTestApp, errorOf, TOKENS, tenantRequest } from "../testing/test-app.ts";

const SESSION_ENDED = "Sesi Anda telah berakhir. Silakan login kembali";

describe("step 1: tenant from subdomain", () => {
  test("an unknown subdomain is 404 even with a valid session", async () => {
    const res = await buildTestApp().request(
      tenantRequest("/documents", { subdomain: "tidak-ada", token: TOKENS.memberA }),
    );
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toEqual({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
  });

  test("the bare base host addresses no tenant", async () => {
    const res = await buildTestApp().request("http://localhost/api/v1/documents");
    expect(res.status).toBe(404);
  });
});

describe("step 2: session from cookie", () => {
  test("no cookie is UNAUTHENTICATED", async () => {
    const res = await buildTestApp().request(tenantRequest("/documents"));
    expect(res.status).toBe(401);
    expect(await errorOf(res)).toEqual({ code: "UNAUTHENTICATED", message: SESSION_ENDED });
  });

  test("an idle-expired session is SESSION_EXPIRED", async () => {
    // AC-40.04: idle expiry is evaluated on read.
    const res = await buildTestApp().request(tenantRequest("/documents", { token: TOKENS.idleA }));
    expect(res.status).toBe(401);
    expect(await errorOf(res)).toEqual({ code: "SESSION_EXPIRED", message: SESSION_ENDED });
  });

  test("an unknown or revoked token is SESSION_EXPIRED", async () => {
    const res = await buildTestApp().request(tenantRequest("/documents", { token: "revoked" }));
    expect(res.status).toBe(401);
    expect((await errorOf(res)).code).toBe("SESSION_EXPIRED");
  });

  test("login is reachable without a session", async () => {
    const res = await buildTestApp().request(
      tenantRequest("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.1" },
        body: JSON.stringify({ email: "budi@contohbaru.co.id", password: "x" }),
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe("step 3: principal tenant matches resolved tenant", () => {
  test("a principal of tenant B on tenant A's host is 404, not 403", async () => {
    // api-specs/01-conventions.md 1.7.1: existence must not leak across tenants.
    const res = await buildTestApp().request(
      tenantRequest("/documents", { token: TOKENS.memberB }),
    );
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toEqual({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
  });

  test("a tenant principal on the admin host is 404", async () => {
    const res = await buildTestApp().request(
      tenantRequest("/tenants", { subdomain: "admin", token: TOKENS.adminA }),
    );
    expect(res.status).toBe(404);
  });

  test("super_admin skips step 3 on a tenant host and is refused at step 4", async () => {
    const res = await buildTestApp().request(
      tenantRequest("/documents", { token: TOKENS.superAdmin }),
    );
    expect(res.status).toBe(403);
  });
});

describe("step 4: role floor", () => {
  test("a member clears a member floor in its own tenant", async () => {
    const res = await buildTestApp().request(
      tenantRequest("/documents", { token: TOKENS.memberA }),
    );
    expect(res.status).toBe(200);
  });

  test("a member is refused a head_of_team floor with 403", async () => {
    const res = await buildTestApp().request(
      tenantRequest("/audit-events", { token: TOKENS.memberA }),
    );
    expect(res.status).toBe(403);
    expect((await errorOf(res)).code).toBe("FORBIDDEN");
  });

  test("admin_tenant inherits every lower floor", async () => {
    const app = buildTestApp();
    expect(
      (await app.request(tenantRequest("/configuration", { token: TOKENS.adminA }))).status,
    ).toBe(200);
    expect(
      (await app.request(tenantRequest("/audit-events", { token: TOKENS.adminA }))).status,
    ).toBe(200);
  });

  test("super_admin reaches super_admin routes on the admin host", async () => {
    const res = await buildTestApp().request(
      tenantRequest("/tenants", { subdomain: "admin", token: TOKENS.superAdmin }),
    );
    expect(res.status).toBe(200);
  });

  test("a tenant admin is refused a super_admin route in its own tenant", async () => {
    const res = await buildTestApp().request(tenantRequest("/tenants", { token: TOKENS.adminA }));
    expect(res.status).toBe(403);
  });

  test("the authenticated floor admits every role, super_admin included", async () => {
    const app = buildTestApp();
    const member = await app.request(tenantRequest("/auth/me", { token: TOKENS.memberA }));
    const superAdmin = await app.request(
      tenantRequest("/auth/me", { subdomain: "admin", token: TOKENS.superAdmin }),
    );
    expect([member.status, superAdmin.status]).toEqual([200, 200]);
  });
});
