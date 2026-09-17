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
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar menus={principal.menus} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header principal={principal} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
