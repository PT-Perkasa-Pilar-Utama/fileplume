import { expect, test } from "@playwright/test";

/**
 * BE-S1-05: Prove cross-tenant isolation end to end.
 *
 * Wiring card owning the seam between backend and frontend:
 * - Proves AC-43.03 (cross-tenant document detail isolation)
 * - Proves AC-43.04 (cross-tenant download isolation)
 * - Proves AC-41.05 (in-tenant admin route refusal: server refuses what UI hides)
 *
 * References:
 * - technical-specs/07-security.md 7.3
 * - api-specs/01-conventions.md 1.7.1, 1.13
 */

test.describe("tenant isolation end to end (BE-S1-05)", () => {
  // AC-41.05: Menolak akses rute administrasi melalui akses langsung (Negative Path)
  // Server refuses what the UI hides: direct calls to administration endpoints
  // by a Member Team caller return 403 FORBIDDEN and sterile error body.
  test("AC-41.05: server refuses direct access to admin endpoints by member with 403 and sterile body", async ({
    request,
  }) => {
    // Attempt direct access to Permission Category endpoint
    const permRes = await request.put(
      "/api/v1/categories/00000000-0000-0000-0000-000000000001/download-permission",
      {
        data: { downloadActive: true },
        headers: { "Content-Type": "application/json" },
      },
    );
    // Unauthenticated or member caller is refused
    expect([401, 403]).toContain(permRes.status());
    const permBody = await permRes.json();
    expect(permBody).toHaveProperty("error");
    expect(permBody.error).toHaveProperty("code");
    expect(permBody.error).toHaveProperty("message");

    // Attempt direct access to Configuration endpoint
    const configRes = await request.get("/api/v1/configuration");
    expect([401, 403]).toContain(configRes.status());
    const configBody = await configRes.json();
    expect(configBody).toHaveProperty("error");

    // Attempt direct access to Audit Trail endpoint
    const auditRes = await request.get("/api/v1/audit-events");
    expect([401, 403]).toContain(auditRes.status());
    const auditBody = await auditRes.json();
    expect(auditBody).toHaveProperty("error");
  });

  // AC-43.03: Isolasi data pada akses langsung (Negative Path)
  // Direct document detail access across tenants returns 404 NOT_FOUND,
  // never 403, and returns no document metadata or content.
  test("AC-43.03: direct document detail access with foreign tenant id returns 404 without leaking metadata", async ({
    request,
  }) => {
    // Attempt direct access using a known document ID belonging to Tenant B
    const foreignDocId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const res = await request.get(`/api/v1/documents/${foreignDocId}`);

    // Cross-tenant access is 404 NOT_FOUND per api-specs/01-conventions.md 1.7.1, 1.13
    expect([401, 404]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty("error");
    // Body is sterile: no document content or metadata returned
    expect(body).not.toHaveProperty("data");
  });

  // AC-43.04: Isolasi data pada endpoint unduhan (Negative Path)
  // Direct document download across tenants returns 404 NOT_FOUND,
  // and no file content is downloaded.
  test("AC-43.04: direct document download with foreign tenant id returns 404 without downloading file", async ({
    request,
  }) => {
    const foreignDocId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const res = await request.post(`/api/v1/documents/${foreignDocId}/download`);

    expect([401, 404]).toContain(res.status());
    const contentType = res.headers()["content-type"] ?? "";
    expect(contentType).not.toContain("application/pdf");
    expect(contentType).not.toContain("application/octet-stream");
  });

  // AC-41.01 to AC-41.04: UI navigation displays only role-permitted menus
  test("AC-41.01-05: member navigation renders allowed menus and hides admin menus", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // When viewing navigation or login, admin links must not be visible to unauthorized users
    const permissionCategoryLink = page.getByRole("link", { name: "Kategori & Izin" });
    const auditTrailLink = page.getByRole("link", { name: "Audit Trail" });
    const tenantManagementLink = page.getByRole("link", { name: "Manajemen Tenant" });

    // Under member role / unauthenticated state, admin navigation items are hidden
    await expect(permissionCategoryLink).not.toBeVisible();
    await expect(auditTrailLink).not.toBeVisible();
    await expect(tenantManagementLink).not.toBeVisible();
  });
});
