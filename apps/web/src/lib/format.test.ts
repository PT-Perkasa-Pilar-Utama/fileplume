import { describe, expect, test } from "bun:test";
import { formatBytes, formatStorage } from "./format.ts";

describe("formatBytes utility", () => {
  test("formats 0 or negative bytes as 0 B", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-10)).toBe("0 B");
  });

  test("formats byte values without fraction", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  test("formats KB values with one decimal place", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  test("formats MB values", () => {
    expect(formatBytes(1024 * 1024 * 5)).toBe("5.0 MB");
  });

  test("formats GB values", () => {
    expect(formatBytes(1024 * 1024 * 1024 * 50)).toBe("50.0 GB");
  });
});

describe("formatStorage utility", () => {
  test("formats used, quota and percent correctly", () => {
    const quotaBytes = 53687091200; // 50 GB
    const usedBytes = 13421772800; // 12.5 GB
    expect(formatStorage(usedBytes, quotaBytes, 25)).toBe("12.5 GB / 50.0 GB (25%)");
  });

  test("calculates percent if omitted", () => {
    const quotaBytes = 1000;
    const usedBytes = 500;
    expect(formatStorage(usedBytes, quotaBytes)).toBe("500 B / 1000 B (50%)");
  });
});
