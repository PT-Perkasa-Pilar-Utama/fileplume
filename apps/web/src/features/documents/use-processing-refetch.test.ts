import { describe, expect, test } from "bun:test";
import { ApiError } from "../../lib/api.ts";
import {
  computeProcessingRefetchInterval,
  DEFAULT_PROCESSING_POLL_INTERVAL_MS,
} from "./use-processing-status.ts";

describe("computeProcessingRefetchInterval (api-specs/07-enrichment.md 7.2)", () => {
  test("returns default 2000ms for queued and processing states", () => {
    expect(computeProcessingRefetchInterval("queued")).toBe(DEFAULT_PROCESSING_POLL_INTERVAL_MS);
    expect(computeProcessingRefetchInterval("processing")).toBe(
      DEFAULT_PROCESSING_POLL_INTERVAL_MS,
    );
  });

  test("returns false to stop polling for ready and failed states", () => {
    expect(computeProcessingRefetchInterval("ready")).toBe(false);
    expect(computeProcessingRefetchInterval("failed")).toBe(false);
    expect(computeProcessingRefetchInterval(undefined)).toBe(false);
  });

  test("returns false on 404 ApiError even when state was pending (AC-46.02, spec 7.2)", () => {
    const notFoundError = new ApiError(404, "NOT_FOUND", "Dokumen tidak ditemukan");
    expect(computeProcessingRefetchInterval("processing", 2000, notFoundError)).toBe(false);
    expect(computeProcessingRefetchInterval("queued", 2000, notFoundError)).toBe(false);
  });
});
