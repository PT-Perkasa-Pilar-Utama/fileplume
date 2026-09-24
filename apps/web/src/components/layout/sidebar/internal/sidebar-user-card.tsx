import type { User } from "@archiva/shared";
import { ChevronsUpDown } from "lucide-react";
import type { JSX } from "react";
import { cn } from "../../../../lib/cn.ts";
import { Avatar, AvatarFallback, AvatarImage } from "../../../ui/avatar.tsx";
import { Button } from "../../../ui/button.tsx";

export type SidebarUser = Pick<User, "avatarUrl" | "name" | "role">;

interface SidebarUserCardProps {
  user?: SidebarUser;
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "U";
  const first = parts[0];
  if (!first) return "U";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const second = parts[1];
  if (!second) return first.slice(0, 2).toUpperCase();
  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
}

export function SidebarUserCard({ user, className }: SidebarUserCardProps): JSX.Element | null {
  if (!user) return null;

  return (
    <div className={cn("flex items-center gap-3 rounded-xl bg-muted/70 p-3", className)}>
      <div className="relative shrink-0">
        <Avatar className="size-10">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        <span
          aria-hidden="true"
          className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-card bg-success"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate font-semibold text-sm leading-tight">{user.name}</span>
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {user.role.toUpperCase()}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Menu pengguna"
        className="size-8 shrink-0"
      >
        <ChevronsUpDown className="size-4" />
      </Button>
    </div>
  );
}
