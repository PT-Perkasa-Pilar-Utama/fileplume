import { describe, expect, test } from "bun:test";
import { DEV_DOCUMENTS, type SeedDocument } from "./dev-documents.ts";
import { DEV_CATEGORIES, DEV_USERS } from "./dev-tenant.ts";
import { QA_TENANT_B_CATEGORIES, QA_TENANT_B_DOCUMENTS, QA_TENANT_B_USERS } from "./qa-dataset.ts";
import { seedContentHash } from "./seed-keys.ts";

/**
 * The window default is 7 days (06-data-model.md 6.3), so the fixtures for
 * AC-02.05 and AC-02.06 have to fall either side of it.
 */
const CONFIRMATION_WINDOW_DAYS = 7;

function contentHashes(documents: readonly SeedDocument[], subdomain: string): string[] {
  return documents.flatMap((document) =>
    Array.from({ length: 1 + (document.extraVersions ?? 0) }, (_, index) =>
      seedContentHash(`${subdomain}:${document.key}:${index + 1}`),
    ),
  );
}

describe.each([
  ["dev", DEV_DOCUMENTS, DEV_USERS, DEV_CATEGORIES, "archiva-demo"] as const,
  [
    "qa tenant B",
    QA_TENANT_B_DOCUMENTS,
    QA_TENANT_B_USERS,
    QA_TENANT_B_CATEGORIES,
    "mitra-rahasia",
  ] as const,
])("%s dataset", (_label, documents, users, categories, subdomain) => {
  test("every uploader is a user the same seed writes", () => {
    const emails = new Set(users.map((user) => user.email));
    for (const document of documents) {
      expect(emails.has(document.uploaderEmail)).toBe(true);
    }
  });

  test("every category referenced exists", () => {
    const names = new Set(categories.map((category) => category.name));
    for (const document of documents) {
      if (document.category) expect(names.has(document.category)).toBe(true);
    }
  });

  test("no document carries more than three tags", () => {
    // AC-05.05: truncated at write time, so a fixture must not exceed it either.
    for (const document of documents) {
      expect((document.tags ?? []).length).toBeLessThanOrEqual(3);
    }
  });

  test("natural keys are unique, so ids and hashes cannot collide", () => {
    const keys = documents.map((document) => document.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("content hashes are unique within the tenant", () => {
    const hashes = contentHashes(documents, subdomain);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  test("only a failed document carries a failure reason", () => {
    for (const document of documents) {
      if (document.failureReason) expect(document.state).toBe("failed");
    }
  });

  test("classification and enrichment belong to ready documents only", () => {
    for (const document of documents) {
      if (document.pages || document.category) expect(document.state).toBe("ready");
    }
  });
});

describe("the dev dataset as the spec describes it", () => {
  test("is roughly twenty documents", () => {
    expect(DEV_DOCUMENTS).toHaveLength(20);
  });

  test("covers every processing state", () => {
    const states = new Set(DEV_DOCUMENTS.map((document) => document.state));
    expect([...states].sort()).toEqual(["failed", "processing", "queued", "ready"]);
  });

  test("includes a failed and a password-protected document", () => {
    const reasons = DEV_DOCUMENTS.filter((d) => d.state === "failed").map((d) => d.failureReason);
    expect(reasons).toContain("password_protected");
    expect(reasons.length).toBeGreaterThan(1);
  });

  test("has an unconfirmed document inside the confirmation window", () => {
    // AC-02.05: only its uploader sees it.
    const fresh = DEV_DOCUMENTS.filter(
      (d) => d.state === "ready" && d.confirmed === false && d.ageDays < CONFIRMATION_WINDOW_DAYS,
    );
    expect(fresh.length).toBeGreaterThan(0);
  });

  test("has an unconfirmed document past the confirmation window", () => {
    // AC-02.06: the whole tenant sees it once the window elapses.
    const aged = DEV_DOCUMENTS.filter(
      (d) => d.state === "ready" && d.confirmed === false && d.ageDays > CONFIRMATION_WINDOW_DAYS,
    );
    expect(aged.length).toBeGreaterThan(0);
  });

  test("files an unclassifiable document under reserved Uncategorized", () => {
    // AC-06.03, and CLAUDE.md: the AI never creates a category.
    const uncategorized = DEV_DOCUMENTS.filter((d) => d.category === "Uncategorized");
    expect(uncategorized.length).toBeGreaterThan(0);
  });
});

describe("the dev user set", () => {
  test("covers every role", () => {
    const roles = new Set(DEV_USERS.map((user) => user.role));
    expect([...roles].sort()).toEqual(["admin_tenant", "head_of_team", "member", "super_admin"]);
  });

  test("has exactly one super_admin, which the CHECK constraint leaves tenantless", () => {
    expect(DEV_USERS.filter((user) => user.role === "super_admin")).toHaveLength(1);
  });
});

describe("the seeded categories", () => {
  test("reserve Uncategorized as a system category", () => {
    const reserved = DEV_CATEGORIES.find((category) => category.name === "Uncategorized");
    expect(reserved?.isSystem).toBe(true);
  });

  test("include Reporting, which AC-06.01 requires to already exist", () => {
    expect(DEV_CATEGORIES.map((category) => category.name)).toContain("Reporting");
  });
});
