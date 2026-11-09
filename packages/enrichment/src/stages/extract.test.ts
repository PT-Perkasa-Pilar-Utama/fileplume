import { describe, expect, test } from "bun:test";
import type { ExtractStageParams, TextExtractionFailure, TextExtractor } from "@archiva/enrichment";
import { executeExtractStage } from "@archiva/enrichment";
import { asDocumentId, asTenantId, asVersionId } from "@archiva/shared";

const tenantId = asTenantId("11111111-1111-4111-8111-111111111111");
const documentId = asDocumentId("22222222-2222-4222-8222-222222222222");
const versionId = asVersionId("33333333-3333-4333-8333-333333333333");

type PersistedRun = Parameters<ExtractStageParams["persist"]>[0];

function createHarness(
  extraction: Awaited<ReturnType<TextExtractor["extract"]>>,
  options: { getFails?: boolean; persistFails?: boolean } = {},
): { persisted: PersistedRun[]; params: ExtractStageParams } {
  const persisted: PersistedRun[] = [];
  return {
    persisted,
    params: {
      tenantId,
      documentId,
      versionId,
      blobKey: "t/1/d/1/v/1",
      mimeType: "application/pdf",
      blobStore: {
        async get(): Promise<ReadableStream> {
          if (options.getFails) throw new Error("blob unavailable");
          return new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array([1]));
              controller.close();
            },
          });
        },
      },
      extractor: {
        async extract(): ReturnType<TextExtractor["extract"]> {
          return extraction;
        },
      },
      async persist(run: PersistedRun): Promise<void> {
        if (options.persistFails) throw new Error("database unavailable");
        persisted.push(run);
      },
    },
  };
}

const unreadable: TextExtractionFailure = { kind: "UnreadableContent" };

describe("executeExtractStage (BE-S3-02)", () => {
  test("persists one document_pages row per extracted page", async () => {
    const harness = createHarness({
      ok: true,
      value: { pages: ["Halaman satu", "Halaman dua"], method: "native", language: "ind" },
    });
    const result = await executeExtractStage(harness.params);
    expect(result.ok).toBe(true);
    expect(harness.persisted).toEqual([
      {
        tenantId,
        documentId,
        versionId,
        pages: ["Halaman satu", "Halaman dua"],
        method: "native",
        language: "ind",
      },
    ]);
  });

  test("AC-44.05: unreadable content returns a permanent failure with no persistence", async () => {
    const harness = createHarness({ ok: false, error: unreadable });
    const result = await executeExtractStage(harness.params);
    expect(result).toEqual({ ok: false, error: { kind: "UnreadableContent" } });
    expect(harness.persisted).toEqual([]);
  });

  test("AC-44.04: a password-protected document returns its own permanent failure", async () => {
    const harness = createHarness({ ok: false, error: { kind: "PasswordProtected" } });
    const result = await executeExtractStage(harness.params);
    expect(result).toEqual({ ok: false, error: { kind: "PasswordProtected" } });
    expect(harness.persisted).toEqual([]);
  });

  test("an empty page list is unreadable content, not a success", async () => {
    const harness = createHarness({ ok: true, value: { pages: [], method: "native" } });
    const result = await executeExtractStage(harness.params);
    expect(result).toEqual({ ok: false, error: { kind: "UnreadableContent" } });
    expect(harness.persisted).toEqual([]);
  });

  test("a blob read failure is transient and never fabricated into a success", async () => {
    const harness = createHarness(
      { ok: true, value: { pages: ["x"], method: "native" } },
      { getFails: true },
    );
    const result = await executeExtractStage(harness.params);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("ExtractionUnavailable");
    expect(harness.persisted).toEqual([]);
  });

  test("a persistence failure is transient and does not claim extraction succeeded", async () => {
    const harness = createHarness(
      { ok: true, value: { pages: ["x"], method: "native" } },
      { persistFails: true },
    );
    const result = await executeExtractStage(harness.params);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("ExtractionUnavailable");
    expect(harness.persisted).toEqual([]);
  });
});
