import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { ConfigParameter } from "@archiva/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useConfiguration } from "./use-configuration.ts";

const PARAM_FILE_SIZE: ConfigParameter = {
  key: "max_file_size_mb",
  label: "Max File Size",
  value: 20,
  defaultValue: 20,
  unit: "MB",
  min: 1,
  max: 200,
  editable: true,
  isDefault: true,
  updatedAt: null,
  updatedBy: null,
};

const PARAM_CONFIRMATION: ConfigParameter = {
  ...PARAM_FILE_SIZE,
  key: "pending_confirmation_days",
  label: "Batas Waktu Konfirmasi Kategori",
  value: 7,
  defaultValue: 7,
  unit: "hari",
  max: 90,
};

let fetchSpy: ReturnType<typeof spyOn>;

function renderConfigHook(initialData: ConfigParameter[] = [PARAM_FILE_SIZE, PARAM_CONFIRMATION]): {
  result: { readonly current: ReturnType<typeof useConfiguration> };
  queryClient: QueryClient;
  unmount: () => void;
} {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(["configuration"], initialData);

  let currentHookResult: ReturnType<typeof useConfiguration>;
  function TestComp(): null {
    currentHookResult = useConfiguration();
    return null;
  }

  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(TestComp),
      ),
    );
  });
  fetchSpy.mockClear();

  return {
    result: {
      get current() {
        return currentHookResult;
      },
    },
    queryClient,
    unmount: () => act(() => root.unmount()),
  };
}

describe("useConfiguration hook", () => {
  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // AC-42.03: "Menolak nilai non-angka... Dan nilai parameter tidak berubah"
  test("a non-numeric value is refused and no request is sent", () => {
    const { result, unmount } = renderConfigHook();

    act(() => result.current.handleStartEdit(PARAM_FILE_SIZE));
    act(() => result.current.setEditValue("dua puluh"));
    act(() => {
      result.current.handleSave(PARAM_FILE_SIZE);
    });

    expect(result.current.rowError).toBe("Nilai harus berupa angka");
    expect(result.current.errorMessage).toBe("Nilai harus berupa angka");
    expect(result.current.parameters?.find((p) => p.key === PARAM_FILE_SIZE.key)?.value).toBe(20);
    expect(fetchSpy).not.toHaveBeenCalled();

    unmount();
  });

  // AC-42.04: "Menolak nilai di luar rentang... Dan nilai parameter tidak berubah" (max_file_size_mb)
  test("an out-of-range value is refused and no request is sent for max_file_size_mb", () => {
    const { result, unmount } = renderConfigHook();

    act(() => result.current.handleStartEdit(PARAM_FILE_SIZE));
    act(() => result.current.setEditValue("500"));
    act(() => {
      result.current.handleSave(PARAM_FILE_SIZE);
    });

    expect(result.current.rowError).toBe("Nilai harus antara 1 dan 200 MB");
    expect(result.current.errorMessage).toBe("Nilai harus antara 1 dan 200 MB");
    expect(result.current.parameters?.find((p) => p.key === PARAM_FILE_SIZE.key)?.value).toBe(20);
    expect(fetchSpy).not.toHaveBeenCalled();

    unmount();
  });

  // AC-42.04: "Menolak nilai di luar rentang" (pending_confirmation_days)
  test("an out-of-range value is refused and no request is sent for pending_confirmation_days", () => {
    const { result, unmount } = renderConfigHook();

    act(() => result.current.handleStartEdit(PARAM_CONFIRMATION));
    act(() => result.current.setEditValue("120"));
    act(() => {
      result.current.handleSave(PARAM_CONFIRMATION);
    });

    expect(result.current.rowError).toBe("Nilai harus antara 1 dan 90 hari");
    expect(result.current.errorMessage).toBe("Nilai harus antara 1 dan 90 hari");
    expect(result.current.parameters?.find((p) => p.key === PARAM_CONFIRMATION.key)?.value).toBe(7);
    expect(fetchSpy).not.toHaveBeenCalled();

    unmount();
  });

  // AC-42.02: "Ketika Saya mengubah nilai... Dan Saya menekan tombol centang... 'Konfigurasi berhasil disimpan'"
  test("saving a valid value calls API, sets success message, and updates stored value", async () => {
    const updatedParam: ConfigParameter = { ...PARAM_FILE_SIZE, value: 50, isDefault: false };
    fetchSpy.mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: updatedParam }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const { result, queryClient, unmount } = renderConfigHook();
    act(() => result.current.handleStartEdit(PARAM_FILE_SIZE));
    act(() => result.current.setEditValue("50"));
    await act(async () => {
      result.current.handleSave(PARAM_FILE_SIZE);
    });

    expect(result.current.successMessage).toBe("Konfigurasi berhasil disimpan");
    expect(result.current.editingKey).toBeNull();
    expect(result.current.rowError).toBeNull();

    const currentCached = queryClient.getQueryData<ConfigParameter[]>(["configuration"]);
    expect(currentCached?.find((p) => p.key === "max_file_size_mb")?.value).toBe(50);

    unmount();
  });

  // AC-42.05: "Ketika Saya menekan tombol 'Kembalikan ke Default'... 'Konfigurasi berhasil disimpan'"
  test("resetting a parameter calls DELETE API, sets success message, and restores default", async () => {
    const modifiedParam: ConfigParameter = { ...PARAM_FILE_SIZE, value: 50, isDefault: false };
    const resetParam: ConfigParameter = { ...PARAM_FILE_SIZE, value: 20, isDefault: true };
    fetchSpy.mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: resetParam }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const { result, queryClient, unmount } = renderConfigHook([modifiedParam]);
    await act(async () => {
      result.current.handleReset("max_file_size_mb");
    });

    expect(result.current.successMessage).toBe("Konfigurasi berhasil disimpan");
    const currentCached = queryClient.getQueryData<ConfigParameter[]>(["configuration"]);
    expect(currentCached?.find((p) => p.key === "max_file_size_mb")?.value).toBe(20);

    unmount();
  });

  // AC-42.03: "nilai parameter tidak berubah" saat membatalkan edit (F5)
  test("cancelling an edit restores the stored value and clears the error", () => {
    const { result, unmount } = renderConfigHook();
    act(() => result.current.handleStartEdit(PARAM_FILE_SIZE));
    act(() => result.current.setEditValue("999"));
    act(() => result.current.setRowError("some error"));
    act(() => result.current.handleCancel());

    expect(result.current.editingKey).toBeNull();
    expect(result.current.rowError).toBeNull();
    expect(result.current.parameters?.find((p) => p.key === PARAM_FILE_SIZE.key)?.value).toBe(20);

    unmount();
  });
});
