import { describe, expect, test } from "bun:test";
import { hasRoleAtLeast } from "./roles.ts";

describe("hasRoleAtLeast", () => {
  test("a role clears its own floor", () => {
    expect(hasRoleAtLeast("member", "member")).toBe(true);
  });

  test("higher roles inherit lower floors", () => {
    expect(hasRoleAtLeast("admin_tenant", "member")).toBe(true);
    expect(hasRoleAtLeast("head_of_team", "member")).toBe(true);
  });

  test("lower roles do not clear higher floors", () => {
    expect(hasRoleAtLeast("member", "head_of_team")).toBe(false);
  });

  test("super_admin sits outside the tenant chain, not above it", () => {
    // technical-specs/09-authentication-authorization.md 9.1
    expect(hasRoleAtLeast("super_admin", "member")).toBe(false);
    expect(hasRoleAtLeast("super_admin", "super_admin")).toBe(true);
    expect(hasRoleAtLeast("admin_tenant", "super_admin")).toBe(false);
  });
});
