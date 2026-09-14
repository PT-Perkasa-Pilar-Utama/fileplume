import { describe, expect, test } from "bun:test";
import { requireRole } from "./guards.ts";

describe("requireRole", () => {
  test("a route cannot be registered without a floor", () => {
    // api-specs/01-conventions.md 1.11. `tsc --build` fails if the floor ever
    // becomes optional, because this directive would then be unused.
    // @ts-expect-error the floor argument is mandatory
    const unguarded = () => requireRole();
    expect(typeof unguarded).toBe("function");
  });
});
