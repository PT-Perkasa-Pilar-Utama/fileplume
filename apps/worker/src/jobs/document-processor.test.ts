import { expect, test } from "bun:test";
import { AlwaysInfectedScanner } from "@archiva/enrichment";
import { asVersionId } from "@archiva/shared";
import { processorHarness } from "../testing/processor-harness.ts";
import { createDocumentProcessor } from "./document-processor.ts";

const FIRST_ATTEMPT = { attempt: 1, maxAttempts: 3 };

test("AC-44.01: scan completes before extraction, then late delivery is a no-op", async () => {
  const h = await processorHarness();
  h.deps.stages.extract = async () => {
    const version = h.deps.catalogRepo.versions[0];
    expect(version?.malwareScannedAt).toBeInstanceOf(Date);
    h.calls.push("extract");
    return { ok: true, value: undefined };
  };
  expect(await h.process(h.documentId, FIRST_ATTEMPT)).toBe("ready");
  expect(await h.process(h.documentId, FIRST_ATTEMPT)).toBe("noop");
  expect(h.calls).toEqual(["extract", "classify", "index"]);
});

test("malware cleanup prevents all parser and downstream calls", async () => {
  const h = await processorHarness();
  const process = createDocumentProcessor({
    ...h.deps,
    scanner: new AlwaysInfectedScanner("fixture"),
  });
  expect(await process(h.documentId, FIRST_ATTEMPT)).toBe("infected");
  expect(h.calls).toEqual(["audit", "quota"]);
  expect(h.deps.catalogRepo.documents).toHaveLength(0);
});

test("a version changing before atomic claim cannot claim the replacement", async () => {
  const h = await processorHarness();
  const processing = h.deps.processing;
  const process = createDocumentProcessor({
    ...h.deps,
    processing: {
      ...processing,
      async claimVersion(tenantId, documentId, versionId) {
        h.doc.currentVersionId = asVersionId(crypto.randomUUID());
        return processing.claimVersion(tenantId, documentId, versionId);
      },
    },
  });
  expect(await process(h.documentId, FIRST_ATTEMPT)).toBe("noop");
  expect(h.doc.processingState).toBe("queued");
  expect(h.calls).toEqual([]);
});

test("a retry bound to an older version cannot claim a newly queued version", async () => {
  const h = await processorHarness();
  h.doc.currentVersionId = asVersionId(crypto.randomUUID());
  expect(
    await h.process(h.documentId, {
      attempt: 2,
      maxAttempts: 3,
      expectedVersionId: h.versionId,
    }),
  ).toBe("noop");
  expect(h.doc.processingState).toBe("queued");
  expect(h.calls).toEqual([]);
});

test("a scan failure after supersession cannot fail the replacement", async () => {
  const h = await processorHarness();
  const process = createDocumentProcessor({
    ...h.deps,
    scanner: {
      async scan() {
        h.doc.currentVersionId = asVersionId(crypto.randomUUID());
        h.doc.processingState = "queued";
        throw new Error("ClamAV unavailable");
      },
    },
  });
  expect(await process(h.documentId, { attempt: 3, maxAttempts: 3 })).toBe("noop");
  expect(h.doc.processingState).toBe("queued");
});

test("a failed scan never invokes extraction", async () => {
  const h = await processorHarness();
  const process = createDocumentProcessor({
    ...h.deps,
    scanner: {
      async scan() {
        throw new Error("ClamAV unavailable");
      },
    },
  });
  expect(await process(h.documentId, FIRST_ATTEMPT)).toBe("retry");
  expect(h.doc.processingState).toBe("processing");
  expect(await process(h.documentId, { attempt: 3, maxAttempts: 3 })).toBe("failed");
  expect(h.doc.processingState).toBe("failed");
  expect(h.doc.failureReason).toBeNull();
  expect(h.calls).toEqual([]);
});
