import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { ConfigParameter } from "@archiva/shared";
import { ERROR_MESSAGES, formatErrorMessage } from "@archiva/shared";
import { ApiError } from "../../lib/api.ts";
import { fetchConfiguration, resetConfigValue, updateConfigValue } from "./api.ts";

const MOCK_PARAMETERS: ConfigParameter[] = [
  {
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
  },
  {
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
  },
  {
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
  },
];

describe("Configuration API", () => {
  const fetchSpy = spyOn(globalThis, "fetch");

  afterEach(() => {
    fetchSpy.mockReset();
  });

  // AC-42.01: Melihat daftar parameter konfigurasi
  test("fetchConfiguration retrieves list of parameters from GET /api/v1/configuration", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: MOCK_PARAMETERS,
          meta: { total: 3 },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await fetchConfiguration();

    expect(result).toHaveLength(3);
    expect(result[0]?.key).toBe("max_file_size_mb");
    expect(result[0]?.label).toBe("Max File Size");
    expect(result[0]?.value).toBe(20);
    expect(result[1]?.key).toBe("pending_confirmation_days");
    expect(result[2]?.key).toBe("storage_quota_gb");
    expect(result[2]?.editable).toBe(false);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(String(url)).toBe("/api/v1/configuration");
    expect(init?.method).toBeUndefined();
  });

  // AC-42.02: Mengubah nilai parameter
  test("updateConfigValue sends PATCH /api/v1/configuration/{key} with numeric value", async () => {
    const baseParam = MOCK_PARAMETERS[0];
    if (!baseParam) throw new Error("Expected MOCK_PARAMETERS[0]");
    const updatedParam: ConfigParameter = {
      ...baseParam,
      value: 50,
      isDefault: false,
      updatedAt: "2026-09-10T04:01:19.000Z",
      updatedBy: {
        id: "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10",
        name: "Sari Dewi",
      },
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: updatedParam }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await updateConfigValue("max_file_size_mb", 50);

    expect(result.value).toBe(50);
    expect(result.isDefault).toBe(false);

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(String(url)).toBe("/api/v1/configuration/max_file_size_mb");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ value: 50 });
  });

  // AC-42.03: Server error response mapping for non-numeric value
  test("updateConfigValue throws ApiError on invalid value refusal", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "INVALID_CONFIG_VALUE",
            message: ERROR_MESSAGES.INVALID_CONFIG_VALUE,
          },
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(updateConfigValue("max_file_size_mb", 0)).rejects.toThrow(
      ERROR_MESSAGES.INVALID_CONFIG_VALUE,
    );
  });

  // AC-42.04: Server error response mapping for out of range value
  test("updateConfigValue throws ApiError on value out of range", async () => {
    const expectedMsg = formatErrorMessage("VALUE_OUT_OF_RANGE", {
      min: 1,
      max: 200,
      unit: "MB",
    });

    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "VALUE_OUT_OF_RANGE",
            message: expectedMsg,
          },
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(updateConfigValue("max_file_size_mb", 500)).rejects.toThrow(expectedMsg);
  });

  // AC-42.05: Mengembalikan parameter ke nilai default
  test("resetConfigValue sends DELETE /api/v1/configuration/{key}", async () => {
    const baseParam = MOCK_PARAMETERS[0];
    if (!baseParam) throw new Error("Expected MOCK_PARAMETERS[0]");
    const resetParam: ConfigParameter = {
      ...baseParam,
      value: 20,
      isDefault: true,
      updatedAt: null,
      updatedBy: null,
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: resetParam }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await resetConfigValue("max_file_size_mb");

    expect(result.value).toBe(20);
    expect(result.isDefault).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(String(url)).toBe("/api/v1/configuration/max_file_size_mb");
    expect(init?.method).toBe("DELETE");
  });

  // Refusal: storage_quota_gb not editable by tenant
  test("updateConfigValue throws 403 on storage_quota_gb refusal", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "NOT_EDITABLE_BY_TENANT",
            message: ERROR_MESSAGES.NOT_EDITABLE_BY_TENANT,
          },
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    try {
      await updateConfigValue("storage_quota_gb", 100);
      expect().fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.status).toBe(403);
        expect(err.code).toBe("NOT_EDITABLE_BY_TENANT");
        expect(err.message).toBe(ERROR_MESSAGES.NOT_EDITABLE_BY_TENANT);
      }
    }
  });
});
