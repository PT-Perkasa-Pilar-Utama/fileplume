import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { StorageView } from "@archiva/shared";
import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/api.ts";
import { fetchStorage, invalidateStorage, STORAGE_QUERY_KEY, storageQueryOptions } from "./api.ts";

const MOCK_STORAGE_OK: StorageView = {
  usedBytes: 13421772800,
  quotaBytes: 53687091200,
  percent: 25,
  level: "ok",
  message: null,
};

const MOCK_STORAGE_WARNING: StorageView = {
  usedBytes: 42949672960,
  quotaBytes: 53687091200,
  percent: 80,
  level: "warning",
  message: "Kapasitas penyimpanan hampir penuh",
};

const MOCK_STORAGE_FULL: StorageView = {
  usedBytes: 53687091200,
  quotaBytes: 53687091200,
  percent: 100,
  level: "full",
  message: "Kapasitas penyimpanan penuh. Hapus atau arsipkan dokumen lama untuk melanjutkan",
};

describe("storage api client (api-specs/04-configuration.md 4.5)", () => {
  const fetchSpy = spyOn(globalThis, "fetch");

  afterEach(() => {
    fetchSpy.mockReset();
  });

  // AC-35.01: Melihat informasi kapasitas penyimpanan
  test("AC-35.01: fetchStorage requests /api/v1/storage and parses level ok response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: MOCK_STORAGE_OK }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchStorage();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0]?.[0];
    expect(calledUrl).toBe("/api/v1/storage");
    expect(result.percent).toBe(25);
    expect(result.level).toBe("ok");
    expect(result.message).toBeNull();
  });

  // AC-35.02: Mendapat peringatan kapasitas hampir penuh
  test("AC-35.02: fetchStorage parses warning level response with verbatim Indonesian copy", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: MOCK_STORAGE_WARNING }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchStorage();

    expect(result.percent).toBe(80);
    expect(result.level).toBe("warning");
    expect(result.message).toBe("Kapasitas penyimpanan hampir penuh");
  });

  test("fetchStorage parses full level response with verbatim error copy", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: MOCK_STORAGE_FULL }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchStorage();

    expect(result.percent).toBe(100);
    expect(result.level).toBe("full");
    expect(result.message).toBe(
      "Kapasitas penyimpanan penuh. Hapus atau arsipkan dokumen lama untuk melanjutkan",
    );
  });

  test("fetchStorage throws ApiError on 401 Unauthorized", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "UNAUTHORIZED",
            message: "Sesi telah berakhir atau tidak valid",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    try {
      await fetchStorage();
      expect().fail("should have thrown ApiError");
    } catch (err: unknown) {
      expect(err instanceof ApiError).toBe(true);
      if (err instanceof ApiError) {
        expect(err.status).toBe(401);
        expect(err.code).toBe("UNAUTHORIZED");
      }
    }
  });

  test("invalidateStorage invalidates the storage query key after uploads settle", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = spyOn(queryClient, "invalidateQueries");

    await invalidateStorage(queryClient);

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: STORAGE_QUERY_KEY });
  });

  test("storageQueryOptions returns configured options with staleTime and enabled flag", () => {
    const optionsDefault = storageQueryOptions();
    expect(optionsDefault.queryKey).toEqual(STORAGE_QUERY_KEY);
    expect(optionsDefault.enabled).toBe(true);
    expect(optionsDefault.staleTime).toBe(120_000);

    const optionsDisabled = storageQueryOptions(false);
    expect(optionsDisabled.enabled).toBe(false);
  });
});
