import { ERROR_MESSAGES } from "@archiva/shared";
import { AlertCircle, CheckCircle2, Search, X } from "lucide-react";
import type { JSX } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Input } from "../../components/ui/input.tsx";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../../components/ui/table.tsx";
import { ConfigurationRow } from "./configuration-row.tsx";
import { useConfiguration } from "./use-configuration.ts";

export function ConfigurationView(): JSX.Element {
  const {
    searchQuery,
    setSearchQuery,
    editingKey,
    editValue,
    setEditValue,
    rowError,
    setRowError,
    successMessage,
    setSuccessMessage,
    errorMessage,
    setErrorMessage,
    parameters,
    filteredParameters,
    isLoading,
    isError,
    error,
    isPending,
    handleStartEdit,
    handleCancel,
    handleSave,
    handleReset,
  } = useConfiguration();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-medium text-base tracking-normal text-[#104D9C] dark:text-blue-400 uppercase">
          CONFIGURATION
        </h1>
        <p className="text-[#1D293D] dark:text-slate-300 text-sm font-normal mt-1">
          Manage system configuration parameters and their values.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative w-[240px] max-w-[240px]">
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-[240px] max-w-[240px] rounded-[10px] border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 px-3 pr-9 text-sm font-normal text-[#020618] dark:text-slate-100 placeholder:text-[#90A1B9] dark:placeholder:text-slate-500 shadow-none focus-visible:ring-1 focus-visible:ring-primary"
            data-testid="search-input"
          />
          <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[#62748E] dark:text-slate-400 pointer-events-none" />
        </div>
      </div>

      {successMessage && (
        <Alert
          variant="success"
          data-testid="success-alert"
          className="justify-between rounded-[10px] border-[#BBF7D0] bg-[#F0FDF4] text-[#00C951] dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 shadow-none"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-[#00C951] dark:text-emerald-400 shrink-0" />
            <AlertDescription className="font-normal text-sm text-[#00C951] dark:text-emerald-400">
              {successMessage}
            </AlertDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-[#00C951] hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
            onClick={() => setSuccessMessage(null)}
            aria-label="Tutup notifikasi"
          >
            <X className="size-3.5" />
          </Button>
        </Alert>
      )}

      {errorMessage && (
        <Alert
          variant="destructive"
          data-testid="error-alert"
          className="justify-between rounded-[10px] shadow-none"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <AlertDescription className="font-normal text-sm">{errorMessage}</AlertDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-destructive hover:bg-destructive/10"
            onClick={() => setErrorMessage(null)}
            aria-label="Tutup notifikasi error"
          >
            <X className="size-3.5" />
          </Button>
        </Alert>
      )}

      <div className="overflow-hidden rounded-[10px] border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-none">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm font-normal">
            Memuat konfigurasi...
          </div>
        ) : isError ? (
          <div className="py-12 text-center text-destructive text-sm font-normal">
            {error?.message ?? ERROR_MESSAGES.INTERNAL_ERROR}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader className="bg-[#F1F5F9] dark:bg-slate-800/60">
                <TableRow className="hover:bg-transparent border-b border-[#E2E8F0] dark:border-slate-800 h-8">
                  <TableHead className="w-1/3 font-medium text-xs text-[#020618] dark:text-slate-200 py-1.5 h-8 font-['Plus_Jakarta_Sans',sans-serif]">
                    Parameter
                  </TableHead>
                  <TableHead className="w-1/6 font-medium text-xs text-[#020618] dark:text-slate-200 py-1.5 h-8 font-['Plus_Jakarta_Sans',sans-serif]">
                    Nilai
                  </TableHead>
                  <TableHead className="w-1/6 font-medium text-xs text-[#020618] dark:text-slate-200 py-1.5 h-8 font-['Plus_Jakarta_Sans',sans-serif]">
                    Satuan
                  </TableHead>
                  <TableHead className="w-1/6 font-medium text-xs text-[#020618] dark:text-slate-200 py-1.5 h-8 font-['Plus_Jakarta_Sans',sans-serif]">
                    Nilai Default
                  </TableHead>
                  <TableHead className="text-right font-medium text-xs text-[#020618] dark:text-slate-200 py-1.5 h-8 pr-4 font-['Plus_Jakarta_Sans',sans-serif]">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParameters?.map((param) => (
                  <ConfigurationRow
                    key={param.key}
                    param={param}
                    isEditing={editingKey === param.key}
                    editValue={editValue}
                    rowError={rowError}
                    isPending={isPending}
                    disabledEdit={editingKey !== null}
                    onStartEdit={handleStartEdit}
                    onCancel={handleCancel}
                    onSave={handleSave}
                    onReset={handleReset}
                    onEditValueChange={(val) => {
                      setEditValue(val);
                      setRowError(null);
                    }}
                  />
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-[#E2E8F0] dark:border-slate-800 px-4 py-2.5 text-[#62748E] dark:text-slate-400 text-xs font-normal">
              Showing 1 - {filteredParameters?.length ?? 0} of {parameters?.length ?? 0} records
            </div>
          </>
        )}
      </div>
    </div>
  );
}
