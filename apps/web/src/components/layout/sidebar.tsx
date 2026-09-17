import type { Menu } from "@archiva/shared";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  FileText,
  FolderKey,
  LayoutDashboard,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { JSX } from "react";
import { cn } from "../../lib/cn.ts";

interface MenuItemConfig {
  key: Menu;
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
}

const MENU_CONFIG: Record<Menu, MenuItemConfig> = {
  dashboard: {
    key: "dashboard",
    label: "Dashboard",
    to: "/",
    icon: LayoutDashboard,
  },
  document: {
    key: "document",
    label: "Dokumen",
    to: "/documents",
    icon: FileText,
  },
  permission_category: {
    key: "permission_category",
    label: "Kategori & Izin",
    to: "/permission-category",
    icon: FolderKey,
  },
  audit_trail: {
    key: "audit_trail",
    label: "Audit Trail",
    to: "/audit-trail",
    icon: ShieldCheck,
  },
  analytics: {
    key: "analytics",
    label: "Analitik",
    to: "/analytics",
    icon: BarChart3,
  },
  configuration: {
    key: "configuration",
    label: "Konfigurasi",
    to: "/configuration",
    icon: Settings,
  },
  tenant_management: {
    key: "tenant_management",
    label: "Manajemen Tenant",
    to: "/tenant-management",
    icon: Building2,
  },
};

interface SidebarProps {
  menus: readonly Menu[];
  className?: string;
}

// SCAFFOLD: FE-S1-03 finalizes and tests role-derived navigation from GET /auth/me menus across all 4 role variants.
export function Sidebar({ menus, className }: SidebarProps): JSX.Element {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const items = menus
    .map((menuKey) => MENU_CONFIG[menuKey])
    .filter((item): item is MenuItemConfig => item !== undefined);

  return (
    <aside className={cn("flex w-64 flex-col border-r bg-card text-card-foreground", className)}>
      <div className="flex h-14 items-center border-b px-4">
        <h2 className="font-bold text-lg tracking-tight text-primary">Archiva</h2>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.to === "/" ? currentPath === "/" : currentPath.startsWith(item.to);

          return (
            <Link
              key={item.key}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
