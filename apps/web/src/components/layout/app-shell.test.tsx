import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { PrincipalView } from "@archiva/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "./app-shell.tsx";

const MEMBER_PRINCIPAL: PrincipalView = {
  user: {
    id: "2b3c4d5e-6f7a-4082-9b0c-1d2e3f4a5b6c",
    name: "Member User",
    email: "member@contohbaru.archiva.id",
    role: "member",
    avatarUrl: null,
  },
  tenant: {
    id: "1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b",
    name: "PT Contoh Baru",
    subdomain: "contohbaru",
  },
  menus: ["dashboard", "document"],
  expiresAt: "2026-09-10T10:00:00.000Z",
};

const SUPER_ADMIN_PRINCIPAL: PrincipalView = {
  user: {
    id: "3c4d5e6f-7a8b-4093-ac1d-2e3f4a5b6c7d",
    name: "Super Admin",
    email: "superadmin@archiva.id",
    role: "super_admin",
    avatarUrl: null,
  },
  tenant: null, // super_admin has no tenant
  menus: ["tenant_management"],
  expiresAt: "2026-09-10T10:00:00.000Z",
};

async function renderAppShell(
  principal: PrincipalView,
  queryClient = new QueryClient(),
): Promise<string> {
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <AppShell principal={principal} />
      </QueryClientProvider>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>Content</div>,
  });
  const routeTree = rootRoute.addChildren([indexRoute]);
  const history = createMemoryHistory({ initialEntries: ["/"] });
  const router = createRouter({ routeTree, history });
  await router.load();
  return renderToStaticMarkup(<RouterProvider router={router} />);
}

describe("AppShell storage wiring (FE-S2-02)", () => {
  const fetchSpy = spyOn(globalThis, "fetch");

  afterEach(() => {
    fetchSpy.mockReset();
  });

  // AC-35.01: Member Team melihat indikator kapasitas penyimpanan
  test("AC-35.01: renders storage indicator for tenant member using live storage query data", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    queryClient.setQueryData(["storage"], {
      usedBytes: 13421772800,
      quotaBytes: 53687091200,
      percent: 25,
      level: "ok",
      message: null,
    });

    const html = await renderAppShell(MEMBER_PRINCIPAL, queryClient);

    expect(html).toContain("Storage Usage");
    expect(html).toContain("25%");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="25"');
    expect(html).toContain("bg-primary");
    expect(html).not.toContain("Kapasitas penyimpanan hampir penuh");
  });

  // AC-35.02: Mendapat peringatan kapasitas hampir penuh
  test("AC-35.02: renders warning banner and color when query returns warning level", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    queryClient.setQueryData(["storage"], {
      usedBytes: 42949672960,
      quotaBytes: 53687091200,
      percent: 80,
      level: "warning",
      message: "Kapasitas penyimpanan hampir penuh",
    });

    const html = await renderAppShell(MEMBER_PRINCIPAL, queryClient);

    expect(html).toContain("Storage Usage");
    expect(html).toContain("80%");
    expect(html).toContain("bg-amber-500");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Kapasitas penyimpanan hampir penuh");
  });

  test("does not fetch storage for super_admin who belongs to no tenant", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const html = await renderAppShell(SUPER_ADMIN_PRINCIPAL, queryClient);

    // fetch was not called for /api/v1/storage
    expect(fetchSpy).not.toHaveBeenCalled();
    // Query cache has no "storage" entry
    expect(queryClient.getQueryData(["storage"])).toBeUndefined();
    // Super admin belongs to no tenant, so storage indicator is not rendered (api-specs/04-configuration.md 4.5)
    expect(html).not.toContain("Storage Usage");
    expect(html).not.toContain("Tidak tersedia");
  });

  test("renders loading skeleton when storage query is pending", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const html = await renderAppShell(MEMBER_PRINCIPAL, queryClient);

    expect(html).toContain("Storage Usage");
    expect(html).toContain("animate-pulse");
    expect(html).toContain('aria-label="Memuat kapasitas penyimpanan"');
    expect(html).not.toContain("0%");
  });

  test("renders explicit unavailable state when storage query fails", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          retryOnMount: false,
          refetchOnMount: false,
        },
      },
    });

    try {
      await queryClient.fetchQuery({
        queryKey: ["storage"],
        queryFn: () => Promise.reject(new Error("500 Internal Server Error")),
      });
    } catch {
      // expected failure to seed error state in cache
    }

    const html = await renderAppShell(MEMBER_PRINCIPAL, queryClient);

    expect(html).toContain("Storage Usage");
    expect(html).toContain("Tidak tersedia");
    expect(html).toContain('aria-label="Kapasitas penyimpanan tidak tersedia"');
    expect(html).not.toContain("0%");
    expect(html).not.toContain('role="progressbar"');
  });
});
