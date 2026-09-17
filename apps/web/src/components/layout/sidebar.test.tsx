import { describe, expect, test } from "bun:test";
import type { Menu } from "@archiva/shared";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { MENU_CONFIG, Sidebar } from "./sidebar.tsx";

async function renderSidebar(menus?: readonly Menu[], currentPath = "/"): Promise<string> {
  const rootRoute = createRootRoute({
    component: () => <Sidebar menus={menus} />,
  });
  const history = createMemoryHistory({ initialEntries: [currentPath] });
  const router = createRouter({ routeTree: rootRoute, history });
  await router.load();
  return renderToStaticMarkup(<RouterProvider router={router} />);
}

describe("Sidebar navigation derived from role menus (FE-S1-03)", () => {
  test("MENU_CONFIG defines exact AC Indonesian labels verbatim", () => {
    expect(MENU_CONFIG.dashboard.label).toBe("Dashboard");
    expect(MENU_CONFIG.document.label).toBe("Document");
    expect(MENU_CONFIG.permission_category.label).toBe("Permission Category");
    expect(MENU_CONFIG.audit_trail.label).toBe("Audit Trail");
    expect(MENU_CONFIG.analytics.label).toBe("Analitik");
    expect(MENU_CONFIG.configuration.label).toBe("Configuration");
    expect(MENU_CONFIG.tenant_management.label).toBe("Manajemen Tenant");
  });

  // AC-41.01: Member Team melihat menu sesuai perannya
  test("AC-41.01: member role renders only Dashboard and Document menus", async () => {
    const memberMenus: readonly Menu[] = ["dashboard", "document"];
    const html = await renderSidebar(memberMenus);

    // Menu yang ditampilkan hanya berisi: Dashboard, Document
    expect(html).toContain("Dashboard");
    expect(html).toContain("Document");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/documents"');

    // Menu dilarang: "Permission Category", "Audit Trail" dan "Configuration" tidak ditampilkan
    expect(html).not.toContain("Permission Category");
    expect(html).not.toContain("Audit Trail");
    expect(html).not.toContain("Configuration");
    expect(html).not.toContain("Analitik");
    expect(html).not.toContain("Manajemen Tenant");
    expect(html).not.toContain('href="/permission-category"');
    expect(html).not.toContain('href="/audit-trail"');
    expect(html).not.toContain('href="/analytics"');
    expect(html).not.toContain('href="/configuration"');
    expect(html).not.toContain('href="/tenant-management"');
  });

  // AC-41.02: Head of Team melihat menu administrasi
  test("AC-41.02: head_of_team role renders member menus plus administrative menus", async () => {
    const headMenus: readonly Menu[] = [
      "dashboard",
      "document",
      "permission_category",
      "audit_trail",
      "analytics",
    ];
    const html = await renderSidebar(headMenus);

    // Seluruh menu Member Team ditambah: Permission Category, Audit Trail, Analitik
    expect(html).toContain("Dashboard");
    expect(html).toContain("Document");
    expect(html).toContain("Permission Category");
    expect(html).toContain("Audit Trail");
    expect(html).toContain("Analitik");
    expect(html).toContain('href="/permission-category"');
    expect(html).toContain('href="/audit-trail"');
    expect(html).toContain('href="/analytics"');

    // Menu Configuration dan Manajemen Tenant tidak ditampilkan
    expect(html).not.toContain("Configuration");
    expect(html).not.toContain("Manajemen Tenant");
    expect(html).not.toContain('href="/configuration"');
    expect(html).not.toContain('href="/tenant-management"');
  });

  // AC-41.03: Admin Tenant melihat seluruh menu tenant
  test("AC-41.03: admin_tenant role renders entire tenant menu suite including Configuration", async () => {
    const adminMenus: readonly Menu[] = [
      "dashboard",
      "document",
      "permission_category",
      "audit_trail",
      "analytics",
      "configuration",
    ];
    const html = await renderSidebar(adminMenus);

    // Seluruh menu Head of Team ditambah: Configuration
    expect(html).toContain("Dashboard");
    expect(html).toContain("Document");
    expect(html).toContain("Permission Category");
    expect(html).toContain("Audit Trail");
    expect(html).toContain("Analitik");
    expect(html).toContain("Configuration");
    expect(html).toContain('href="/configuration"');

    // Super admin menu tidak ditampilkan
    expect(html).not.toContain("Manajemen Tenant");
    expect(html).not.toContain('href="/tenant-management"');
  });

  // AC-41.04: Super Admin melihat menu lintas tenant
  test("AC-41.04: super_admin role renders only cross-tenant menu without tenant document menus", async () => {
    const superAdminMenus: readonly Menu[] = ["tenant_management"];
    const html = await renderSidebar(superAdminMenus);

    // Hanya berisi: Manajemen Tenant
    expect(html).toContain("Manajemen Tenant");
    expect(html).toContain('href="/tenant-management"');

    // Menu dokumen milik tenant tidak ditampilkan
    expect(html).not.toContain("Dashboard");
    expect(html).not.toContain("Document");
    expect(html).not.toContain("Permission Category");
    expect(html).not.toContain("Audit Trail");
    expect(html).not.toContain("Analitik");
    expect(html).not.toContain("Configuration");
    expect(html).not.toContain('href="/documents"');
    expect(html).not.toContain('href="/permission-category"');
    expect(html).not.toContain('href="/audit-trail"');
    expect(html).not.toContain('href="/analytics"');
    expect(html).not.toContain('href="/configuration"');
  });

  test("highlights active menu item matching current route", async () => {
    const menus: readonly Menu[] = ["dashboard", "document"];
    const html = await renderSidebar(menus, "/documents");

    expect(html).toContain('href="/documents"');
    // Active link has bg-primary styling and aria-current="page"
    expect(html).toMatch(/<a[^>]*bg-primary[^>]*href="\/documents"/);
    expect(html).toMatch(/<a[^>]*href="\/documents"[^>]*aria-current="page"/);
  });

  test("handles empty or undefined menus gracefully without throwing", async () => {
    const htmlEmpty = await renderSidebar([]);
    expect(htmlEmpty).toContain("Archiva");
    expect(htmlEmpty).toContain('aria-label="Navigasi Utama"');
    expect(htmlEmpty).not.toContain("href=");

    const htmlUndefined = await renderSidebar(undefined);
    expect(htmlUndefined).toContain("Archiva");
    expect(htmlUndefined).toContain('aria-label="Navigasi Utama"');
    expect(htmlUndefined).not.toContain("href=");
  });
});
