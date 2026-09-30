import { describe, expect, test } from "bun:test";
import { FAILURE_MESSAGE, STATE_LABEL } from "@archiva/shared";
import { canTransition, isTransient, MAX_TAGS, STAGES, truncateTags } from "./service.ts";

describe("state machine", () => {
  test("queued only moves to processing", () => {
    expect(canTransition("queued", "processing")).toBe(true);
    expect(canTransition("queued", "ready")).toBe(false);
  });

  test("processing stays processing across a retry", () => {
    // AC-44.02 forbids a flicker to failed and back.
    expect(canTransition("processing", "processing")).toBe(true);
  });

  test("a ready document cannot be moved backwards by a stale job", () => {
    expect(canTransition("ready", "processing")).toBe(false);
    expect(canTransition("ready", "failed")).toBe(false);
  });

  test("both terminal states allow a manual retry", () => {
    expect(canTransition("failed", "queued")).toBe(true);
    expect(canTransition("ready", "queued")).toBe(true);
  });
});

describe("retry classification", () => {
  test("bad input does not retry", () => {
    // Retrying a password-protected PDF three times reaches the same answer.
    expect(isTransient("password_protected")).toBe(false);
    expect(isTransient("unreadable_content")).toBe(false);
  });

  test("infrastructure failures retry", () => {
    expect(isTransient("ai_unavailable")).toBe(true);
    expect(isTransient("extraction_timeout")).toBe(true);
  });
});

describe("labels", () => {
  test("the four states carry their Indonesian labels verbatim", () => {
    // AC-44.01
    expect(STATE_LABEL).toEqual({
      queued: "Antre",
      processing: "Diproses",
      ready: "Siap",
      failed: "Gagal",
    });
  });

  test("the two named failure reasons match their criteria", () => {
    // AC-44.04 and AC-44.05
    expect(FAILURE_MESSAGE.password_protected).toBe("Dokumen terproteksi password");
    expect(FAILURE_MESSAGE.unreadable_content).toBe("Isi dokumen tidak dapat dibaca");
  });
});

describe("tag truncation", () => {
  test("keeps the three highest-confidence tags", () => {
    // AC-05.05: five tags in, three stored.
    const tags = [
      { tag: "a", confidence: 0.2 },
      { tag: "b", confidence: 0.9 },
      { tag: "c", confidence: 0.5 },
      { tag: "d", confidence: 0.7 },
      { tag: "e", confidence: 0.1 },
    ];
    const kept = truncateTags(tags);
    expect(kept).toHaveLength(MAX_TAGS);
    expect(kept.map((t) => t.tag)).toEqual(["b", "d", "c"]);
  });

  test("does not mutate its input", () => {
    const tags = [
      { tag: "a", confidence: 0.1 },
      { tag: "b", confidence: 0.9 },
    ];
    truncateTags(tags);
    expect(tags[0]?.tag).toBe("a");
  });
});

describe("pipeline order", () => {
  test("scanning comes first, as a security property", () => {
    expect(STAGES[0]).toBe("scan");
    expect(STAGES).toEqual(["scan", "extract", "classify", "index"]);
  });
});
