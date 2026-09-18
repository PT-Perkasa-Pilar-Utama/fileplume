import type { PrincipalView } from "@archiva/shared";
import { LogOut, Moon, Settings, Sun } from "lucide-react";
import type { JSX } from "react";
import { logoutRequest } from "../../features/auth/api.ts";
import { useAuthStore } from "../../features/auth/auth-store.ts";
import { cn } from "../../lib/cn.ts";
import { useThemeStore } from "../../lib/theme-store.ts";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar.tsx";
import { Button } from "../ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx";

interface HeaderProps {
  principal: PrincipalView;
  className?: string;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "U";
  const first = parts[0];
  if (!first) return "U";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const second = parts[1];
  if (!second) return first.slice(0, 2).toUpperCase();
  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
}

export async function handleLogout(): Promise<void> {
  try {
    await logoutRequest();
  } catch {
    // Ignore network failure on logout; local session is cleared regardless.
  } finally {
    useAuthStore.getState().clearSession();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }
}

export function Header({ principal, className }: HeaderProps): JSX.Element {
  const { theme, toggleTheme } = useThemeStore();
  const tenantName = principal.tenant?.name ?? "Super Admin";
  const user = principal.user;

  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between border-b bg-card px-6 text-card-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="font-medium text-sm text-muted-foreground">{tenantName}</span>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Ganti tema"
          className="size-8"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>

        <DropdownMenu>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3">
              <Avatar className="size-8">
                {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-left">
                <span className="font-medium text-sm leading-none">{user.name}</span>
                <span className="text-xs text-muted-foreground font-semibold">
                  {user.role.toUpperCase()}
                </span>
              </div>
            </div>

            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Pengaturan profil"
                className="size-8 text-muted-foreground hover:text-foreground"
              >
                <Settings className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </div>

          <DropdownMenuContent align="end" aria-label="Menu profil" className="w-56">
            <div className="px-2 py-1.5 text-left">
              <p className="font-medium text-sm leading-none">{user.name}</p>
              <p className="text-xs text-muted-foreground mt-1 truncate">{user.email}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-1">
                {user.role.toUpperCase()}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut className="size-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
