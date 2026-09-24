import { ERROR_MESSAGES } from "@archiva/shared";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import type { JSX } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert.tsx";
import { Button } from "../../components/ui/button.tsx";
import { SearchInput } from "../../components/ui/search-input.tsx";
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
        <h1 className="font-medium text-base tracking-normal text-brand-title uppercase">
          CONFIGURATION
        </h1>
        <p className="text-muted-foreground text-sm font-normal mt-1">
          Kelola parameter konfigurasi sistem dan nilainya.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="w-60 max-w-60">
          <SearchInput
            iconPosition="trailing"
            type="text"
            placeholder="Cari parameter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="search-input"
          />
        </div>
      </div>

      {successMessage && (
        <Alert
          variant="success"
          data-testid="success-alert"
          className="justify-between shadow-none"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <AlertDescription className="font-normal text-sm">{successMessage}</AlertDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 hover:bg-alert-success-bg"
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
          className="justify-between shadow-none"
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

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-none">
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
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-1/3">Parameter</TableHead>
                  <TableHead className="w-1/6">Nilai</TableHead>
                  <TableHead className="w-1/6">Satuan</TableHead>
                  <TableHead className="w-1/6">Nilai Default</TableHead>
                  <TableHead className="text-right pr-4">Aksi</TableHead>
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
            <div className="border-t border-border px-4 py-2.5 text-muted-foreground text-xs font-normal">
              Menampilkan {filteredParameters?.length ?? 0} dari {parameters?.length ?? 0} parameter
            </div>
          </>
        )}
      </div>
    </div>
  );
}
