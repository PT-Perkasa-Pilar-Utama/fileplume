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
 * Allows switching the active version for preview and download.
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
          className="h-8 gap-1.5 text-xs font-medium"
          data-testid="version-picker-trigger"
          aria-label={`Pilih versi dokumen, saat ini ${activeLabel}`}
        >
          <span>{activeLabel}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
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
                "flex items-center justify-between text-xs py-1.5",
                isSelected && "font-semibold bg-muted",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span>{versionLabel}</span>
                {version.isCurrent && (
                  <span className="rounded bg-secondary px-1 text-[10px] text-muted-foreground font-normal">
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
