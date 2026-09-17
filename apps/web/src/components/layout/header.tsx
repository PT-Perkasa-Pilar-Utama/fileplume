import type { PrincipalView } from "@archiva/shared";
import { LogOut, Moon, Settings, Sun } from "lucide-react";
import { type JSX, useEffect, useRef, useState } from "react";
import { logoutRequest } from "../../features/auth/api.ts";
import { useAuthStore } from "../../features/auth/auth-store.ts";
import { cn } from "../../lib/cn.ts";
import { useThemeStore } from "../../lib/theme-store.ts";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar.tsx";
import { Button } from "../ui/button.tsx";

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

export function Header({ principal, className }: HeaderProps): JSX.Element {
  const { theme, toggleTheme } = useThemeStore();
  const clearSession = useAuthStore((s) => s.clearSession);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async (): Promise<void> => {
    try {
      await logoutRequest();
    } catch {
      // Ignore network failure on logout; local session is cleared regardless.
    } finally {
      clearSession();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

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

        <div className="relative" ref={menuRef}>
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

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Pengaturan profil"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="size-8 text-muted-foreground hover:text-foreground"
            >
              <Settings className="size-4" />
            </Button>
          </div>

          {menuOpen ? (
            <div
              role="menu"
              aria-label="Menu profil"
              className="absolute right-0 z-50 mt-2 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
            >
              <div className="px-2 py-1.5 text-left">
                <p className="font-medium text-sm leading-none">{user.name}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{user.email}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-1">
                  {user.role.toUpperCase()}
                </p>
              </div>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 focus:bg-destructive/10 transition-colors"
              >
                <LogOut className="size-4" />
                <span>Logout</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
