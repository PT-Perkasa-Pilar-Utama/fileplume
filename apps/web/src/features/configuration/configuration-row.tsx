import type { ConfigKeyName, ConfigParameter } from "@archiva/shared";
import { Check, Pencil, RotateCcw, X } from "lucide-react";
import type { JSX } from "react";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Input } from "../../components/ui/input.tsx";
import { TableCell, TableRow } from "../../components/ui/table.tsx";

interface ConfigurationRowProps {
  param: ConfigParameter;
  isEditing: boolean;
  editValue: string;
  rowError: string | null;
  isPending: boolean;
  disabledEdit: boolean;
  onStartEdit: (param: ConfigParameter) => void;
  onCancel: () => void;
  onSave: (param: ConfigParameter) => void;
  onReset: (key: ConfigKeyName) => void;
  onEditValueChange: (val: string) => void;
}

export function ConfigurationRow({
  param,
  isEditing,
  editValue,
  rowError,
  isPending,
  disabledEdit,
  onStartEdit,
  onCancel,
  onSave,
  onReset,
  onEditValueChange,
}: ConfigurationRowProps): JSX.Element {
  return (
    <TableRow data-testid={`row-${param.key}`} className="hover:bg-muted/40 transition-colors h-10">
      <TableCell>{param.label}</TableCell>
      <TableCell>
        {isEditing ? (
          <div className="space-y-1">
            <Input
              type="text"
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              className="h-7 w-24 text-sm rounded-sm px-2"
              autoFocus
              disabled={isPending}
              data-testid={`input-${param.key}`}
            />
            {rowError && (
              <p
                className="text-xs text-destructive font-normal"
                data-testid={`row-error-${param.key}`}
              >
                {rowError}
              </p>
            )}
          </div>
        ) : (
          <span data-testid={`value-${param.key}`}>{param.value}</span>
        )}
      </TableCell>
      <TableCell>{param.unit}</TableCell>
      <TableCell>{param.defaultValue}</TableCell>
      <TableCell className="text-right pr-4">
        <div className="flex items-center justify-end gap-2">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-alert-success-text hover:bg-alert-success-bg"
                onClick={() => onSave(param)}
                disabled={isPending}
                aria-label="Simpan"
                title="Simpan"
                data-testid={`save-${param.key}`}
              >
                <Check className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={onCancel}
                disabled={isPending}
                aria-label="Batal"
                title="Batal"
                data-testid={`cancel-${param.key}`}
              >
                <X className="size-4" />
              </Button>
            </>
          ) : param.editable ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStartEdit(param)}
                disabled={isPending || disabledEdit}
                data-testid={`edit-${param.key}`}
              >
                <Pencil className="mr-1.5 size-3.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onReset(param.key)}
                disabled={isPending || param.isDefault}
                className="text-muted-foreground hover:text-foreground"
                data-testid={`reset-${param.key}`}
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Kembalikan ke Default
              </Button>
            </>
          ) : (
            <Badge variant="secondary" data-testid={`readonly-${param.key}`}>
              Hanya Super Admin
            </Badge>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
