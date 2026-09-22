import type { PrincipalView } from "@archiva/shared";
import { Outlet } from "@tanstack/react-router";
import type { JSX } from "react";
import { useStorage } from "../../features/storage/api.ts";
import { Header } from "./header.tsx";
import { Sidebar } from "./sidebar.tsx";

interface AppShellProps {
  principal: PrincipalView;
}

export function AppShell({ principal }: AppShellProps): JSX.Element {
  // api-specs/04-configuration.md 4.5: storage usage is tenant-scoped; super_admin belongs to no tenant.
  const hasTenant = principal.tenant !== null;
  const { data: storage, isPending, isError } = useStorage({ enabled: hasTenant });

  // api-specs/04-configuration.md 4.5 is a member operation. A principal with no
  // tenant has no figure to report, which is not the same as one that failed to load.
  const storageState: "loading" | "error" | "ready" = isPending
    ? "loading"
    : isError
      ? "error"
      : "ready";

  return (
    <div className="flex min-h-screen gap-3 bg-muted/50 p-3 text-foreground">
      <Sidebar
        menus={principal.menus}
        user={principal.user}
        showStorage={hasTenant}
        storage={storage}
        storageState={storageState}
      />
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border bg-background">
        <Header principal={principal} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
