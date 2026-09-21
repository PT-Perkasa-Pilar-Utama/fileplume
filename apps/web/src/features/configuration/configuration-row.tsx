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
    <TableRow
      data-testid={`row-${param.key}`}
      className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition-colors border-b border-[#E2E8F0] dark:border-slate-800/60 h-10"
    >
      <TableCell className="font-normal text-sm text-[#020618] dark:text-slate-100 py-2.5">
        {param.label}
      </TableCell>
      <TableCell className="font-normal text-sm text-[#020618] dark:text-slate-100 py-2.5">
        {isEditing ? (
          <div className="space-y-1">
            <Input
              type="text"
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              className="h-7 w-24 text-sm font-normal rounded-[6px] border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#020618] dark:text-slate-100 px-2"
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
      <TableCell className="font-normal text-sm text-[#020618] dark:text-slate-100 py-2.5">
        {param.unit}
      </TableCell>
      <TableCell className="font-normal text-sm text-[#020618] dark:text-slate-100 py-2.5">
        {param.defaultValue}
      </TableCell>
      <TableCell className="text-right py-2.5 pr-4">
        <div className="flex items-center justify-end gap-2">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30"
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
                className="size-7 text-[#62748E] hover:text-[#020618] dark:text-slate-400 dark:hover:text-slate-200"
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
                className="h-7 rounded-[8px] border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-normal text-[#020618] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-none"
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
                className="h-7 px-2 text-xs font-normal text-[#62748E] hover:text-[#020618] dark:text-slate-400 dark:hover:text-slate-200 hover:bg-transparent"
                data-testid={`reset-${param.key}`}
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Kembalikan ke Default
              </Button>
            </>
          ) : (
            <Badge
              variant="secondary"
              className="rounded-[6px] border border-[#E2E8F0] dark:border-slate-700 bg-[#F1F5F9] dark:bg-slate-800/80 px-2.5 py-0.5 text-xs font-normal text-[#62748E] dark:text-slate-400 shadow-none"
              data-testid={`readonly-${param.key}`}
            >
              Hanya Super Admin
            </Badge>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
