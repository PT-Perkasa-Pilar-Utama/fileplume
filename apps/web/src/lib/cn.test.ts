import { describe, expect, test } from "bun:test";
import { cn } from "./cn.ts";

describe("cn utility", () => {
  test("merges class names correctly", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  test("overrides conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  test("handles conditional classes", () => {
    const isHidden = false;
    const isBlock = true;
    expect(cn("base-class", isHidden && "hidden", isBlock && "block")).toBe("base-class block");
  });
});
