import { describe, expect, test } from "bun:test";
import { inMemoryCatalogRepository, inMemoryProcessingRepository } from "@archiva/catalog";
import { asTenantId, asUserId, asVersionId, err, ok } from "@archiva/shared";
import { createPipeline, type PipelineStage, type StageFailure } from "./pipeline.ts";

async function harness() {
  const tenantId = asTenantId(crypto.randomUUID());
  const catalog = inMemoryCatalogRepository();
  const inserted = await catalog.insertDocumentWithVersion(tenantId, {
    uploaderId: asUserId(crypto.randomUUID()),
    filename: "test.pdf",
    contentHash: "test",
    mimeType: "application/pdf",
    sizeBytes: 10,
    blobKey: "isolated",
  });
  if (!inserted.ok) throw new Error("Fixture insert failed");
  const doc = catalog.documents[0];
  if (!doc?.currentVersionId) throw new Error("Missing fixture version");
  const run = { tenantId, documentId: doc.id, versionId: doc.currentVersionId };
  const state = inMemoryProcessingRepository(catalog.documents);
  await state.claimVersion(tenantId, doc.id, doc.currentVersionId);
  const calls: string[] = [];
  const stage =
    (name: string): PipelineStage =>
    async () => {
      calls.push(name);
      return ok(undefined);
    };
  const deps = {
    state,
    extract: stage("extract"),
    classify: stage("classify"),
    index: stage("index"),
    derivedData: {
      async removeIfCurrent(run: { versionId: string }) {
        // The guard is evaluated at effect time, as a real adapter must.
        if (doc.currentVersionId !== run.versionId) return false;
        calls.push("cleanup");
        return true;
      },
    },
  };
  return { catalog, doc, run, calls, deps };
}

describe("document pipeline", () => {
  test("AC-44.01: completion requires each downstream stage in order", async () => {
    const h = await harness();
    expect(await createPipeline(h.deps)(h.run, 1, 3)).toBe("ready");
    expect(h.calls).toEqual(["extract", "classify", "index"]);
    expect(h.doc.processingState).toBe("ready");
  });

  test("AC-44.02: transient failures preserve processing until the final attempt", async () => {
    const h = await harness();
    h.deps.classify = async () => err({ reason: "ai_unavailable", retryable: true });
    const process = createPipeline(h.deps);
    for (const attempt of [1, 2]) {
      expect(await process(h.run, attempt, 3)).toBe("retry");
      expect(h.doc.processingState).toBe("processing");
      expect(h.calls).not.toContain("cleanup");
    }
    expect(await process(h.run, 3, 3)).toBe("failed");
    expect(h.doc.failureReason).toBe("ai_unavailable");
    expect(h.calls).not.toContain("index");
  });

  test("AC-44.03: failure removes derived data without deleting document or version", async () => {
    const h = await harness();
    h.deps.index = async () => err({ reason: "index_failed", retryable: false });
    expect(await createPipeline(h.deps)(h.run, 1, 3)).toBe("failed");
    expect(h.calls).toEqual(["extract", "classify", "cleanup"]);
    expect(h.catalog.documents).toHaveLength(1);
    expect(h.catalog.versions).toHaveLength(1);
    expect(h.doc.failureReason).toBe("index_failed");
  });

  test("permanent extraction failures bypass retry", async () => {
    const h = await harness();
    const failure: StageFailure = { reason: "password_protected", retryable: false };
    h.deps.extract = async () => err(failure);
    expect(await createPipeline(h.deps)(h.run, 1, 3)).toBe("failed");
    expect(h.calls).toEqual(["cleanup"]);
    expect(h.doc.failureReason).toBe("password_protected");
  });

  test("permanent extraction failures do not retry when marked retryable", async () => {
    for (const reason of ["password_protected", "unreadable_content"] as const) {
      const h = await harness();
      h.deps.extract = async () => err({ reason, retryable: true });
      expect(await createPipeline(h.deps)(h.run, 1, 3)).toBe("failed");
      expect(h.doc.failureReason).toBe(reason);
    }
  });

  test("late delivery after ready invokes no stages", async () => {
    const h = await harness();
    h.doc.processingState = "ready";
    expect(await createPipeline(h.deps)(h.run, 1, 3)).toBe("stale");
    expect(h.calls).toEqual([]);
  });

  test("a version superseded during classification cannot complete the new run", async () => {
    const h = await harness();
    h.deps.classify = async () => {
      h.doc.processingState = "queued";
      return ok(undefined);
    };
    expect(await createPipeline(h.deps)(h.run, 1, 3)).toBe("stale");
    expect(h.calls).toEqual(["extract"]);
    expect(h.doc.processingState).toBe("queued");
  });

  test("a superseded failure cannot remove new-version derived data or fail its document", async () => {
    const h = await harness();
    h.deps.classify = async () => {
      h.doc.processingState = "queued";
      return err({ reason: "ai_unavailable", retryable: true });
    };
    expect(await createPipeline(h.deps)(h.run, 3, 3)).toBe("stale");
    expect(h.calls).not.toContain("cleanup");
    expect(h.doc.processingState).toBe("queued");
  });

  test("supersession during failure cleanup cannot fail the replacement run", async () => {
    const h = await harness();
    h.deps.extract = async () => err({ reason: "unreadable_content", retryable: false });
    let release: () => void = () => {};
    let entered: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const cleanup = h.deps.derivedData.removeIfCurrent;
    h.deps.derivedData.removeIfCurrent = async (run) => {
      entered();
      await gate;
      return cleanup(run);
    };
    const result = createPipeline(h.deps)(h.run, 3, 3);
    await started;
    h.doc.currentVersionId = asVersionId(crypto.randomUUID());
    h.doc.processingState = "queued";
    release();
    expect(await result).toBe("stale");
    expect(h.calls).not.toContain("cleanup");
    expect(h.doc.processingState).toBe("queued");
  });

  test("cleanup failure cannot produce a falsely recorded terminal state", async () => {
    const h = await harness();
    h.deps.extract = async () => err({ reason: "unreadable_content", retryable: false });
    h.deps.derivedData.removeIfCurrent = async () => {
      throw new Error("Cleanup unavailable");
    };
    await expect(createPipeline(h.deps)(h.run, 1, 3)).rejects.toThrow("Cleanup unavailable");
    expect(h.doc.processingState).toBe("processing");
  });
});
