import { describe, expect, test } from "bun:test";
import type { DocumentVersionView } from "@archiva/shared";
import { renderToString } from "react-dom/server";
import { VersionPicker } from "./version-picker.tsx";

const mockVersions: DocumentVersionView[] = [
  {
    id: "version-1-id",
    versionNumber: 1,
    filename: "proposal-v1.pdf",
    sizeBytes: 1024,
    pageCount: 10,
    uploadedBy: { id: "user-1", name: "User 1" },
    createdAt: "2026-09-01T09:00:00.000Z",
    isCurrent: false,
  },
  {
    id: "version-2-id",
    versionNumber: 2,
    filename: "proposal-v2.pdf",
    sizeBytes: 2048,
    pageCount: 12,
    uploadedBy: { id: "user-1", name: "User 1" },
    createdAt: "2026-09-05T09:00:00.000Z",
    isCurrent: false,
  },
  {
    id: "version-3-id",
    versionNumber: 3,
    filename: "proposal-v3.pdf",
    sizeBytes: 3072,
    pageCount: 15,
    uploadedBy: { id: "user-1", name: "User 1" },
    createdAt: "2026-09-10T09:00:00.000Z",
    isCurrent: true,
  },
];

describe("VersionPicker component (AC-21.02)", () => {
  // AC-21.02: Dropdown displays active version
  test("renders trigger with active version label", () => {
    const html = renderToString(
      <VersionPicker
        versions={mockVersions}
        activeVersionId="version-1-id"
        onSelectVersion={() => {}}
      />,
    );

    expect(html).toContain("v1");
    expect(html).toContain('data-testid="version-picker-trigger"');
  });

  // AC-21.02: Dropdown lists every version newest first (v3, v2, v1)
  test("renders dropdown menu listing every version newest first when opened", () => {
    const html = renderToString(
      <VersionPicker
        versions={mockVersions}
        activeVersionId="version-1-id"
        onSelectVersion={() => {}}
        open={true}
      />,
    );

    expect(html).toContain("Riwayat Versi");
    expect(html).toContain('data-testid="version-item-version-3-id"');
    expect(html).toContain('data-testid="version-item-version-2-id"');
    expect(html).toContain('data-testid="version-item-version-1-id"');

    // Verify newest first ordering: v3 appears before v2, which appears before v1
    const idxV3 = html.indexOf('data-testid="version-item-version-3-id"');
    const idxV2 = html.indexOf('data-testid="version-item-version-2-id"');
    const idxV1 = html.indexOf('data-testid="version-item-version-1-id"');

    expect(idxV3).toBeLessThan(idxV2);
    expect(idxV2).toBeLessThan(idxV1);

    // Verify indicator for current version
    expect(html).toContain("terbaru");
  });
});
