import {
  type ConfigKeyName,
  type ConfigParameter,
  ERROR_MESSAGES,
  formatErrorMessage,
} from "@archiva/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchConfiguration, resetConfigValue, updateConfigValue } from "./api.ts";

export interface UseConfigurationReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  editingKey: ConfigKeyName | null;
  editValue: string;
  setEditValue: (val: string) => void;
  rowError: string | null;
  setRowError: (error: string | null) => void;
  successMessage: string | null;
  setSuccessMessage: (msg: string | null) => void;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  parameters: ConfigParameter[] | undefined;
  filteredParameters: ConfigParameter[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isPending: boolean;
  handleStartEdit: (param: ConfigParameter) => void;
  handleCancel: () => void;
  handleSave: (param: ConfigParameter) => void;
  handleReset: (key: ConfigKeyName) => void;
}

export function useConfiguration(): UseConfigurationReturn {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [editingKey, setEditingKey] = useState<ConfigKeyName | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [rowError, setRowError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["configuration"],
    queryFn: fetchConfiguration,
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: ConfigKeyName; value: number }) =>
      updateConfigValue(key, value),
    onSuccess: (updated) => {
      setSuccessMessage("Konfigurasi berhasil disimpan");
      setEditingKey(null);
      setRowError(null);
      setErrorMessage(null);
      queryClient.setQueryData<ConfigParameter[]>(["configuration"], (prev) => {
        if (!prev) return [updated];
        return prev.map((p) => (p.key === updated.key ? updated : p));
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : ERROR_MESSAGES.INTERNAL_ERROR;
      setRowError(msg);
      setErrorMessage(msg);
      setSuccessMessage(null);
    },
  });

  const resetMutation = useMutation({
    mutationFn: (key: ConfigKeyName) => resetConfigValue(key),
    onSuccess: (reset) => {
      setSuccessMessage("Konfigurasi berhasil disimpan");
      setEditingKey(null);
      setRowError(null);
      setErrorMessage(null);
      queryClient.setQueryData<ConfigParameter[]>(["configuration"], (prev) => {
        if (!prev) return [reset];
        return prev.map((p) => (p.key === reset.key ? reset : p));
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : ERROR_MESSAGES.INTERNAL_ERROR;
      setErrorMessage(msg);
      setSuccessMessage(null);
    },
  });

  const handleStartEdit = (param: ConfigParameter): void => {
    setEditingKey(param.key);
    setEditValue(String(param.value));
    setRowError(null);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleCancel = (): void => {
    setEditingKey(null);
    setEditValue("");
    setRowError(null);
  };

  const handleSave = (param: ConfigParameter): void => {
    const trimmed = editValue.trim();

    // AC-42.03: Menolak nilai non-angka dengan pesan verbatim
    if (!/^-?\d+$/.test(trimmed)) {
      const msg = ERROR_MESSAGES.INVALID_CONFIG_VALUE;
      setRowError(msg);
      setErrorMessage(msg);
      setSuccessMessage(null);
      return;
    }

    const numVal = parseInt(trimmed, 10);

    // AC-42.04: Menolak nilai di luar rentang dengan pesan verbatim
    if (numVal < param.min || numVal > param.max) {
      const msg = formatErrorMessage("VALUE_OUT_OF_RANGE", {
        min: param.min,
        max: param.max,
        unit: param.unit,
      });
      setRowError(msg);
      setErrorMessage(msg);
      setSuccessMessage(null);
      return;
    }

    updateMutation.mutate({ key: param.key, value: numVal });
  };

  const handleReset = (key: ConfigKeyName): void => {
    resetMutation.mutate(key);
  };

  const isPending = updateMutation.isPending || resetMutation.isPending;

  const filteredParameters = query.data?.filter((param) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      param.label.toLowerCase().includes(q) ||
      param.key.toLowerCase().includes(q) ||
      param.unit.toLowerCase().includes(q)
    );
  });

  return {
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
    parameters: query.data,
    filteredParameters,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error : null,
    isPending,
    handleStartEdit,
    handleCancel,
    handleSave,
    handleReset,
  };
}
