import { describe, expect, test } from "bun:test";
import { isVisibleToViewer } from "./service.ts";

const NOW = new Date("2026-09-10T00:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000);
const OWNER = "owner-1";
const COLLEAGUE = "colleague-1";

describe("confirmation window", () => {
  test("the uploader always sees their own unconfirmed document", () => {
    const doc = { uploaderId: OWNER, confirmedAt: null, createdAt: daysAgo(1) };
    expect(isVisibleToViewer(doc, { userId: OWNER, bypassesWindow: false }, 7, NOW)).toBe(true);
  });

  test("a colleague does not see a fresh unconfirmed document", () => {
    // AC-02.05
    const doc = { uploaderId: OWNER, confirmedAt: null, createdAt: daysAgo(1) };
    expect(isVisibleToViewer(doc, { userId: COLLEAGUE, bypassesWindow: false }, 7, NOW)).toBe(
      false,
    );
  });

  test("a colleague sees it once the window elapses", () => {
    // AC-02.06
    const doc = { uploaderId: OWNER, confirmedAt: null, createdAt: daysAgo(8) };
    expect(isVisibleToViewer(doc, { userId: COLLEAGUE, bypassesWindow: false }, 7, NOW)).toBe(true);
  });

  test("a confirmed document is tenant-wide immediately", () => {
    // AC-02.03
    const doc = { uploaderId: OWNER, confirmedAt: NOW, createdAt: daysAgo(1) };
    expect(isVisibleToViewer(doc, { userId: COLLEAGUE, bypassesWindow: false }, 7, NOW)).toBe(true);
  });

  test("Head of Team bypasses the window entirely", () => {
    // AC-02.07
    const doc = { uploaderId: OWNER, confirmedAt: null, createdAt: daysAgo(0) };
    expect(isVisibleToViewer(doc, { userId: COLLEAGUE, bypassesWindow: true }, 7, NOW)).toBe(true);
  });

  test("the window honours the tenant's configured length", () => {
    const doc = { uploaderId: OWNER, confirmedAt: null, createdAt: daysAgo(8) };
    const viewer = { userId: COLLEAGUE, bypassesWindow: false };
    expect(isVisibleToViewer(doc, viewer, 30, NOW)).toBe(false);
  });
});
