import type { Menu, StorageView } from "@archiva/shared";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  Folder,
  FolderKey,
  LayoutGrid,
  PanelLeft,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { JSX } from "react";
import { cn } from "../../lib/cn.ts";
import { ArchivaLogo, ArchivaLogoIcon } from "../ui/archiva-logo.tsx";
import { Button } from "../ui/button.tsx";
import { type SidebarUser, SidebarUserCard } from "./sidebar/internal/sidebar-user-card.tsx";
import { StorageUsage } from "./sidebar/internal/storage-usage.tsx";

export interface MenuItemConfig {
  key: Menu;
  label: string;
  to: string;
  icon: typeof LayoutGrid;
}

export const MENU_CONFIG: Record<Menu, MenuItemConfig> = {
  dashboard: {
    key: "dashboard",
    label: "Dashboard",
    to: "/",
    icon: LayoutGrid,
  },
  document: {
    key: "document",
    label: "Document",
    to: "/documents",
    icon: Folder,
  },
  permission_category: {
    key: "permission_category",
    label: "Permission Category",
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
    label: "Configuration",
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

export interface SidebarProps {
  menus?: readonly Menu[];
  user?: SidebarUser;
  showStorage?: boolean;
  storage?: StorageView | null;
  storageState?: "loading" | "error" | "ready";
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

export function Sidebar({
  menus = [],
  user,
  showStorage = true,
  storage,
  storageState,
  collapsed = false,
  onToggleCollapse,
  className,
}: SidebarProps): JSX.Element {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const items = menus
    .map((menuKey) => MENU_CONFIG[menuKey])
    .filter((item): item is MenuItemConfig => item !== undefined);

  return (
    <aside
      className={cn(
        "flex flex-col rounded-2xl border bg-card text-card-foreground shadow-sm",
        collapsed ? "w-20" : "w-64",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b px-4",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {collapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            aria-label="Buka sidebar"
            className="size-8"
          >
            <ArchivaLogoIcon className="size-6" />
          </Button>
        ) : (
          <>
            <div className="flex items-center">
              <ArchivaLogo className="h-5.5 w-auto" />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              aria-label="Tutup sidebar"
              className="size-8"
            >
              <PanelLeft className="size-4" />
            </Button>
          </>
        )}
      </div>
      <nav aria-label="Navigasi Utama" className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.to === "/" ? currentPath === "/" : currentPath.startsWith(item.to);

          return (
            <Link
              key={item.key}
              to={item.to}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-4 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-muted font-semibold text-primary"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className={cn("size-4 shrink-0", isActive && "text-foreground")} />
              {collapsed ? null : <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      {collapsed ? null : (
        <div className="space-y-3 p-3">
          {showStorage ? <StorageUsage storage={storage} state={storageState} /> : null}
          <SidebarUserCard user={user} />
        </div>
      )}
    </aside>
  );
}
