import type { PrincipalView } from "@archiva/shared";
import { Outlet } from "@tanstack/react-router";
import type { JSX } from "react";
import { Header } from "./header.tsx";
import { Sidebar } from "./sidebar.tsx";

interface AppShellProps {
  principal: PrincipalView;
}

export function AppShell({ principal }: AppShellProps): JSX.Element {
  return (
    <div className="flex min-h-screen gap-3 bg-muted/50 p-3 text-foreground">
      {/* SCAFFOLD(FE-S2-02): pass live storage percent from GET /storage once the indicator is wired (api-specs/04-configuration.md 4.5). */}
      <Sidebar menus={principal.menus} user={principal.user} />
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border bg-background">
        <Header principal={principal} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
