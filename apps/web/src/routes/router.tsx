import {
  createRootRoute,
  createRoute,
  createRouter,
  isRedirect,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import type { JSX } from "react";
import { AppShell } from "../components/layout/app-shell.tsx";
import { fetchCurrentPrincipal } from "../features/auth/api.ts";
import { useAuthStore } from "../features/auth/auth-store.ts";
import { ApiError } from "../lib/api.ts";
import { LoginPage, type LoginSearchParams } from "./login.tsx";
import {
  AnalyticsView,
  AuditTrailView,
  ConfigurationView,
  DashboardView,
  DocumentDetailView,
  DocumentsView,
  NotFoundView,
  PermissionCategoryView,
  TenantManagementView,
} from "./views.tsx";

export async function checkAuthBeforeLoad(locationHref: string): Promise<void> {
  const store = useAuthStore.getState();
  if (store.principal) return;

  try {
    const principal = await fetchCurrentPrincipal();
    store.setPrincipal(principal);
  } catch (error: unknown) {
    if (isRedirect(error)) throw error;
    if (error instanceof ApiError && error.status === 401) {
      store.setSessionExpired(error.message);
      throw redirect({
        to: "/login",
        search: {
          redirect: locationHref === "/" ? undefined : locationHref,
          expired: true,
        },
      });
    }
    throw error;
  }
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFoundView,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>): LoginSearchParams => {
    return {
      redirect: typeof search.redirect === "string" ? search.redirect : undefined,
      expired: search.expired === true || search.expired === "true",
    };
  },
  component: LoginPage,
});

const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_auth",
  beforeLoad: async ({ location }) => {
    await checkAuthBeforeLoad(location.href);
  },
  component: (): JSX.Element | null => {
    const principal = useAuthStore((s) => s.principal);
    if (!principal) return null;
    return <AppShell principal={principal} />;
  },
});

const indexRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/",
  component: DashboardView,
});

const dashboardRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/dashboard",
  component: DashboardView,
});

const documentsRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/documents",
  component: DocumentsView,
});

const documentDetailRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/documents/$id",
  component: DocumentDetailView,
});

const permissionCategoryRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/permission-category",
  component: PermissionCategoryView,
});

const auditTrailRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/audit-trail",
  component: AuditTrailView,
});

const analyticsRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/analytics",
  component: AnalyticsView,
});

const configurationRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/configuration",
  component: ConfigurationView,
});

const tenantManagementRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/tenant-management",
  component: TenantManagementView,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  authLayoutRoute.addChildren([
    indexRoute,
    dashboardRoute,
    documentsRoute,
    documentDetailRoute,
    permissionCategoryRoute,
    auditTrailRoute,
    analyticsRoute,
    configurationRoute,
    tenantManagementRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
