import { describe, expect, test } from "bun:test";
import { AUDIT_ACTIONS, auditLabel } from "./service.ts";

describe("audit labels", () => {
  test("a denied download renders the exact criterion string", () => {
    // AC-13.02 asserts on "Unduhan ditolak".
    expect(auditLabel("document.download", "denied")).toBe("Unduhan ditolak");
  });

  test("an allowed download does not", () => {
    expect(auditLabel("document.download", "allowed")).toBe("Unduhan");
  });

  test("every action has a label", () => {
    for (const action of AUDIT_ACTIONS) {
      expect(auditLabel(action, "allowed").length).toBeGreaterThan(0);
    }
  });
});

describe("audit action enum", () => {
  test("carries the two members the criteria need but the data model lacks", () => {
    // api-specs/_index.md open items 2 and 3.
    expect(AUDIT_ACTIONS).toContain("access.denied");
    expect(AUDIT_ACTIONS).toContain("search.performed");
  });
});
