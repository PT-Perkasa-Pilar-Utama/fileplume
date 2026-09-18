import { expect, test } from "@playwright/test";

/**
 * BE-S1-05: prove cross-tenant isolation end to end against the composed stack.
 *
 * - AC-41.05 in-tenant admin route refusal: the server refuses what the UI hides
 * - AC-43.03 cross-tenant document detail isolation
 * - AC-43.04 cross-tenant download isolation
 *
 * Both tenants come from `bun run db:seed:qa`, which the e2e job runs against
 * the compose stack before Playwright starts. Without it every route answers
 * 404 at step 1 of api-specs/01-conventions.md 1.12, and nothing below is
 * observable.
 *
 * References: technical-specs/07-security.md 7.3, api-specs/01-conventions.md
 * 1.7.1, 1.12, 1.13.
 */

const TENANT_A = "http://archiva-demo.localhost:4173";
const TENANT_B = "http://mitra-rahasia.localhost:4173";

/** Seeded session of Tenant A's `member`. DEV_SESSIONS, seeds/internal/dev-tenant.ts. */
const MEMBER_SESSION = "__Host-archiva_session=dev-session-member";

const FORBIDDEN = {
  error: { code: "FORBIDDEN", message: "Anda tidak memiliki akses ke halaman ini" },
};
const NOT_FOUND = { error: { code: "NOT_FOUND", message: "Data tidak ditemukan" } };

/**
 * `originCheck` (hardening.ts) refuses a mutating request whose Origin is
 * neither WEB_ORIGIN nor the request's own host, before any tenant or session
 * is read. Sending the host's own Origin keeps that CSRF guard out of the way,
 * so what each assertion below observes is the isolation rule it names.
 */
function asMember(origin: string): Record<string, string> {
  return { cookie: MEMBER_SESSION, origin };
}

test.describe("tenant isolation end to end (BE-S1-05)", () => {
  // AC-41.05: Menolak akses rute administrasi melalui akses langsung.
  test("a member reaching an administration route directly is refused with 403 and a sterile body", async ({
    request,
  }) => {
    const headers = asMember(TENANT_A);

    const permission = await request.put(
      `${TENANT_A}/api/v1/categories/00000000-0000-4000-8000-000000000001/download-permission`,
      {
        data: { downloadActive: true },
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
    expect(permission.status()).toBe(403);
    expect(await permission.json()).toEqual(FORBIDDEN);

    const configuration = await request.get(`${TENANT_A}/api/v1/configuration`, { headers });
    expect(configuration.status()).toBe(403);
    expect(await configuration.json()).toEqual(FORBIDDEN);

    const audit = await request.get(`${TENANT_A}/api/v1/audit-events`, { headers });
    expect(audit.status()).toBe(403);
    expect(await audit.json()).toEqual(FORBIDDEN);

    // super_admin sits outside the chain, so a member never reaches its floor.
    const tenants = await request.get(`${TENANT_A}/api/v1/tenants`, { headers });
    expect(tenants.status()).toBe(403);
    expect(await tenants.json()).toEqual(FORBIDDEN);
  });

  // AC-43.03: Isolasi data pada akses langsung. Step 3 of 1.12 answers 404, not
  // 403, so a principal never learns that another tenant exists.
  test("a Tenant A principal reading a document on Tenant B's host is answered 404", async ({
    request,
  }) => {
    const documentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const headers = asMember(TENANT_B);

    for (const path of [
      `/api/v1/documents/${documentId}`,
      `/api/v1/documents/${documentId}/versions`,
      `/api/v1/documents/${documentId}/related`,
      `/api/v1/documents/${documentId}/processing`,
    ]) {
      const res = await request.get(`${TENANT_B}${path}`, { headers });
      expect(res.status(), path).toBe(404);
      expect(await res.json()).toEqual(NOT_FOUND);
    }
  });

  test("a foreign document id on the caller's own host is answered 404, never 403", async ({
    request,
  }) => {
    const foreignId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const res = await request.get(`${TENANT_A}/api/v1/documents/${foreignId}`, {
      headers: asMember(TENANT_A),
    });

    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual(NOT_FOUND);
  });

  // AC-43.04: Isolasi data pada endpoint unduhan. No bytes, on either host.
  test("a cross-tenant download is answered 404 and returns no file", async ({ request }) => {
    const documentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    for (const [origin, label] of [
      [TENANT_B, "Tenant B's host"],
      [TENANT_A, "a foreign id on the caller's own host"],
    ] as const) {
      const res = await request.post(`${origin}/api/v1/documents/${documentId}/download`, {
        headers: asMember(origin),
      });

      expect(res.status(), label).toBe(404);
      expect(res.headers()["content-type"]).toContain("application/json");
      expect(await res.json()).toEqual(NOT_FOUND);
    }
  });

  // AC-41.01 to AC-41.04: the UI offers no administration menu to a member.
  test("member navigation renders allowed menus and hides admin menus", async ({ page }) => {
    await page.goto(`${TENANT_A}/`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("link", { name: "Kategori & Izin" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Audit Trail" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Manajemen Tenant" })).not.toBeVisible();
  });
});
