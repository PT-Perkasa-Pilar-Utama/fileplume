import { describe, expect, test } from "bun:test";
import { getInitials } from "./header.tsx";

describe("Header helper functions", () => {
  // AC-40.01: Avatar fallback initials
  test("getInitials extracts two letters for two-part names", () => {
    expect(getInitials("Budi Santoso")).toBe("BS");
    expect(getInitials("John Doe")).toBe("JD");
  });

  test("getInitials handles single-word names", () => {
    expect(getInitials("Admin")).toBe("AD");
    expect(getInitials("A")).toBe("A");
  });

  test("getInitials handles three or more words", () => {
    expect(getInitials("Siti Nur Haliza")).toBe("SN");
  });

  test("getInitials handles empty or whitespace-only strings", () => {
    expect(getInitials("")).toBe("U");
    expect(getInitials("   ")).toBe("U");
  });
});
