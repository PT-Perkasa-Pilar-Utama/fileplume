import { describe, expect, test } from "bun:test";
import type { Menu, StorageView } from "@archiva/shared";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import type { SidebarUser } from "./sidebar/internal/sidebar-user-card.tsx";
import { Sidebar } from "./sidebar.tsx";

const MEMBER_USER: SidebarUser = {
  name: "Team Mbr",
  role: "member",
  avatarUrl: null,
};

const DEFAULT_STORAGE: StorageView = {
  usedBytes: 13421772800,
  quotaBytes: 53687091200,
  percent: 25,
  level: "ok",
  message: null,
};

async function renderSidebarLayout(
  menus: readonly Menu[] = ["dashboard", "document"],
  currentPath = "/",
  user: SidebarUser | null = MEMBER_USER,
  storage: StorageView | null = DEFAULT_STORAGE,
): Promise<string> {
  const rootRoute = createRootRoute({
    component: () => <Sidebar menus={menus} user={user ?? undefined} storage={storage} />,
  });
  const history = createMemoryHistory({ initialEntries: [currentPath] });
  const router = createRouter({ routeTree: rootRoute, history });
  await router.load();
  return renderToStaticMarkup(<RouterProvider router={router} />);
}

describe("Sidebar slicing sesuai gambar", () => {
  test("header menampilkan brand dan tombol collapse", async () => {
    const html = await renderSidebarLayout();
    expect(html).toContain("Archiva");
    expect(html).toContain("uppercase");
    expect(html).toContain("Tutup sidebar");
  });

  test("menu aktif Dashboard memakai aria-current dan style aktif", async () => {
    const html = await renderSidebarLayout(["dashboard", "document"], "/");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("bg-slate-100");
    expect(html).toContain("rounded-2xl");
    // Ikon menu aktif hitam, teks biru (detail Figma)
    expect(html).toContain("lucide-layout-grid size-4 shrink-0 text-foreground");
    expect(html).toContain("Dashboard");
    expect(html).toContain("Document");
  });

  test("kartu Storage Usage menampilkan persen dan progressbar", async () => {
    const html = await renderSidebarLayout();
    expect(html).toContain("Storage Usage");
    expect(html).toContain("25%");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="25"');
  });

  test("kartu user menampilkan nama, role uppercase, dan inisial fallback", async () => {
    const html = await renderSidebarLayout();
    expect(html).toContain("Team Mbr");
    expect(html).toContain("MEMBER");
    expect(html).toContain("TM");
    expect(html).toContain("Menu pengguna");
  });

  test("tanpa user, kartu user tidak dirender tapi storage tetap ada", async () => {
    const html = await renderSidebarLayout(["dashboard", "document"], "/", null);
    expect(html).toContain("Storage Usage");
    expect(html).not.toContain("Menu pengguna");
  });
});
