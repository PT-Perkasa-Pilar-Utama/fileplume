import { describe, expect, test } from "bun:test";
import { seedContentHash, seedId } from "./seed-keys.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("seedId", () => {
  test("the same natural key always gives the same id", () => {
    // The whole point: a rerun has to update the same document row rather than
    // insert a second one. technical-specs/06-data-model.md 6.11.
    expect(seedId("document:archiva-demo:laporan.pdf")).toBe(
      seedId("document:archiva-demo:laporan.pdf"),
    );
  });

  test("different natural keys give different ids", () => {
    expect(seedId("document:archiva-demo:laporan.pdf")).not.toBe(
      seedId("document:archiva-demo:proposal.pdf"),
    );
  });

  test("the same key in another tenant is a different id", () => {
    expect(seedId("document:archiva-demo:rahasia.pdf")).not.toBe(
      seedId("document:mitra-rahasia:rahasia.pdf"),
    );
  });

  test("is a well-formed uuid the column will accept", () => {
    expect(seedId("document:archiva-demo:laporan.pdf")).toMatch(UUID);
  });
});

describe("seedContentHash", () => {
  test("fills char(64) exactly", () => {
    const hash = seedContentHash("archiva-demo:laporan.pdf:1");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("differs per version, so UNIQUE (tenant_id, content_hash) holds", () => {
    expect(seedContentHash("archiva-demo:proposal.pdf:1")).not.toBe(
      seedContentHash("archiva-demo:proposal.pdf:2"),
    );
  });
});
