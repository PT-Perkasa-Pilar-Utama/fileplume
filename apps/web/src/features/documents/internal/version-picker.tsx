import type { DocumentVersionView } from "@archiva/shared";
import { Check, ChevronDown } from "lucide-react";
import type { JSX } from "react";
import { Button } from "../../../components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu.tsx";
import { cn } from "../../../lib/cn.ts";

export interface VersionPickerProps {
  readonly versions: readonly DocumentVersionView[];
  readonly activeVersionId: string;
  readonly onSelectVersion: (version: DocumentVersionView) => void;
  readonly disabled?: boolean;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

/**
 * Dropdown version picker listing every document version newest first (AC-21.02).
 * Styled as a pill badge trigger matching Figma screen 28:3451.
 */
export function VersionPicker({
  versions,
  activeVersionId,
  onSelectVersion,
  disabled,
  open,
  onOpenChange,
}: VersionPickerProps): JSX.Element {
  // Sort versions newest first by versionNumber descending
  const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const activeVersion = sortedVersions.find((v) => v.id === activeVersionId) ?? sortedVersions[0];

  const activeLabel = activeVersion ? `v${activeVersion.versionNumber}` : "v1";

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          size="sm"
          className="h-6 rounded-full px-2.5 py-0.5 text-xs font-medium gap-1.5 border-border bg-background hover:bg-muted text-foreground transition-colors shadow-2xs"
          data-testid="version-picker-trigger"
          aria-label={`Pilih versi dokumen, saat ini ${activeLabel}`}
        >
          <span>{activeLabel}</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl p-1 shadow-md">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-medium px-2 py-1.5">
          Riwayat Versi
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sortedVersions.map((version) => {
          const isSelected = version.id === activeVersion?.id;
          const versionLabel = `v${version.versionNumber}`;

          return (
            <DropdownMenuItem
              key={version.id}
              data-testid={`version-item-${version.id}`}
              onClick={() => onSelectVersion(version)}
              className={cn(
                "flex items-center justify-between text-xs px-2 py-1.5 rounded-lg cursor-pointer",
                isSelected && "font-semibold bg-muted",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span>{versionLabel}</span>
                {version.isCurrent && (
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground font-normal">
                    terbaru
                  </span>
                )}
              </div>
              {isSelected && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
