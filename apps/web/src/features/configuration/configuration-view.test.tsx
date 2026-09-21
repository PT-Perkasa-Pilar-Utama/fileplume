import { describe, expect, test } from "bun:test";
import type { ConfigParameter } from "@archiva/shared";
import { ERROR_MESSAGES } from "@archiva/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { renderToString } from "react-dom/server";
import { ConfigurationRow } from "./configuration-row.tsx";
import { ConfigurationView } from "./configuration-view.tsx";

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
  key: "pending_confirmation_days",
  label: "Batas Waktu Konfirmasi Kategori",
  value: 7,
  defaultValue: 7,
  unit: "hari",
  min: 1,
  max: 90,
  editable: true,
  isDefault: true,
  updatedAt: null,
  updatedBy: null,
};

const PARAM_STORAGE: ConfigParameter = {
  key: "storage_quota_gb",
  label: "Kuota Penyimpanan",
  value: 50,
  defaultValue: 50,
  unit: "GB",
  min: 1,
  max: 10000,
  editable: false,
  isDefault: true,
  updatedAt: null,
  updatedBy: null,
};

const MOCK_PARAMS: ConfigParameter[] = [PARAM_FILE_SIZE, PARAM_CONFIRMATION, PARAM_STORAGE];

function renderRow(overrides: Partial<ComponentProps<typeof ConfigurationRow>> = {}): string {
  const param = overrides.param ?? PARAM_FILE_SIZE;
  return renderToString(
    <table>
      <tbody>
        <ConfigurationRow
          param={param}
          isEditing={false}
          editValue=""
          rowError={null}
          isPending={false}
          disabledEdit={false}
          onStartEdit={() => {}}
          onCancel={() => {}}
          onSave={() => {}}
          onReset={() => {}}
          onEditValueChange={() => {}}
          {...overrides}
        />
      </tbody>
    </table>,
  );
}

describe("ConfigurationView and ConfigurationRow", () => {
  // AC-42.01: Melihat daftar parameter konfigurasi
  test("renders table with columns Parameter, Nilai, Satuan, Nilai Default and action buttons", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["configuration"], MOCK_PARAMS);

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <ConfigurationView />
      </QueryClientProvider>,
    );

    // Columns
    expect(html).toContain("Parameter");
    expect(html).toContain("Nilai");
    expect(html).toContain("Satuan");
    expect(html).toContain("Nilai Default");
    expect(html).toContain("Aksi");

    // Parameter names and values
    expect(html).toContain("Max File Size");
    expect(html).toContain("20");
    expect(html).toContain("MB");

    expect(html).toContain("Batas Waktu Konfirmasi Kategori");
    expect(html).toContain("7");
    expect(html).toContain("hari");

    expect(html).toContain("Kuota Penyimpanan");
    expect(html).toContain("50");
    expect(html).toContain("GB");

    // Readonly quota row
    expect(html).toContain("Hanya Super Admin");
  });

  // AC-42.01: ConfigurationRow renders read-only badge for storage_quota_gb
  test("ConfigurationRow renders badge Hanya Super Admin when editable is false", () => {
    const html = renderRow({ param: PARAM_STORAGE });

    expect(html).toContain("Kuota Penyimpanan");
    expect(html).toContain("Hanya Super Admin");
    expect(html).not.toContain('data-testid="edit-storage_quota_gb"');
  });

  // AC-42.02: ConfigurationRow renders input and check icon when editing
  test("ConfigurationRow renders inline input and check icon when isEditing is true", () => {
    const html = renderRow({ param: PARAM_FILE_SIZE, isEditing: true, editValue: "50" });

    expect(html).toContain('data-testid="input-max_file_size_mb"');
    expect(html).toContain('data-testid="save-max_file_size_mb"');
    expect(html).toContain('data-testid="cancel-max_file_size_mb"');
  });

  // AC-42.03: ConfigurationRow renders inline row error message
  test("ConfigurationRow renders row error message when rowError is provided", () => {
    const html = renderRow({
      param: PARAM_FILE_SIZE,
      isEditing: true,
      editValue: "dua puluh",
      rowError: ERROR_MESSAGES.INVALID_CONFIG_VALUE,
    });

    expect(html).toContain("Nilai harus berupa angka");
    expect(html).toContain('data-testid="row-error-max_file_size_mb"');
  });

  // AC-42.04: ConfigurationRow renders out-of-range error message
  test("ConfigurationRow renders out-of-range error message when rowError is provided", () => {
    const html = renderRow({
      param: PARAM_FILE_SIZE,
      isEditing: true,
      editValue: "500",
      rowError: "Nilai harus antara 1 dan 200 MB",
    });

    expect(html).toContain("Nilai harus antara 1 dan 200 MB");
    expect(html).toContain('data-testid="row-error-max_file_size_mb"');
  });

  // AC-42.05: Reset control renders Kembalikan ke Default
  test("ConfigurationRow renders Kembalikan ke Default button", () => {
    const modifiedParam: ConfigParameter = {
      ...PARAM_FILE_SIZE,
      value: 50,
      isDefault: false,
    };

    const html = renderRow({ param: modifiedParam });

    expect(html).toContain("Kembalikan ke Default");
    expect(html).toContain('data-testid="reset-max_file_size_mb"');
  });
});
