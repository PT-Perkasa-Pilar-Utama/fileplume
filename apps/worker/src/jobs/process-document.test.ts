import { describe, expect, test } from "bun:test";
import {
  inMemoryBlobStore,
  inMemoryCatalogRepository,
  type StoredDocument,
  type StoredVersion,
} from "@archiva/catalog";
import {
  AlwaysCleanScanner,
  AlwaysInfectedScanner,
  type ScanAuditPort,
  type ScanQuotaPort,
} from "@archiva/enrichment";
import { asDocumentId, asTenantId, asUserId, asVersionId } from "@archiva/shared";
import { createProcessDocumentHandler } from "./process-document.ts";

function createWorkerTestHarness(params?: {
  docState?: "queued" | "processing" | "ready" | "failed";
  scanner?: "clean" | "infected";
  signature?: string;
}) {
  const tenantId = asTenantId("11111111-1111-4111-8111-111111111111");
  const docId = asDocumentId("22222222-2222-4222-8222-222222222222");
  const verId = asVersionId("33333333-3333-4333-8333-333333333333");
  const uploaderId = asUserId("44444444-4444-4444-8444-444444444444");

  const blobKey = `t/${tenantId}/d/${docId}/v/${verId}`;
  const blobStore = inMemoryBlobStore();

  const doc: StoredDocument = {
    id: docId,
    tenantId,
    title: "dokumen-uji.pdf",
    currentVersionId: verId,
    processingState: params?.docState ?? "queued",
    failureReason: null,
    uploaderId,
    uploaderName: "Budi Santoso",
    createdAt: new Date("2026-09-10T05:20:44.000Z"),
    categoryId: null,
    categoryName: null,
    categoryIsSystem: false,
    categoryConfirmedAt: null,
    categoryDownloadActive: false,
    documentType: null,
    tags: [],
    author: null,
    documentCreatedAt: null,
  };

  const ver: StoredVersion = {
    id: verId,
    tenantId,
    documentId: docId,
    versionNumber: 1,
    contentHash: "hash-dokumen-uji",
    filename: "dokumen-uji.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    pageCount: 1,
    malwareScannedAt: null,
    malwareSignature: params?.signature ?? null,
    blobKey,
    uploadedById: uploaderId,
    uploadedByName: "Budi Santoso",
    createdAt: doc.createdAt,
  };

  const catalogRepo = inMemoryCatalogRepository({
    documents: [doc],
    versions: [ver],
    seedFixtures: false,
  });

  const revertedQuotas: Array<{ documentId: string; tenantId: string; bytes: number }> = [];
  const quota: ScanQuotaPort = {
    async revertCommittedDocumentQuota(reservation) {
      revertedQuotas.push(reservation);
    },
  };

  const auditEvents: Array<{
    tenantId: string;
    actorId: string | null;
    action: string;
    subjectType: string;
    subjectId: string | null;
    outcome: string;
    metadata?: Record<string, unknown>;
  }> = [];
  const audit: ScanAuditPort = {
    async record(event) {
      auditEvents.push(event);
    },
  };

  const scanner =
    params?.scanner === "infected"
      ? new AlwaysInfectedScanner("Eicar-Test-Signature")
      : new AlwaysCleanScanner();

  const handler = createProcessDocumentHandler({
    catalogRepo,
    blobStore,
    quota,
    audit,
    scanner,
  });

  return {
    tenantId,
    docId,
    verId,
    uploaderId,
    blobKey,
    blobStore,
    catalogRepo,
    revertedQuotas,
    auditEvents,
    handler,
  };
}

describe("processDocument worker job (BE-S2-07)", () => {
  test("AC-46.01: clean file clears the scan and remains in processing", async () => {
    const harness = createWorkerTestHarness({ scanner: "clean" });
    await harness.blobStore.put(
      harness.blobKey,
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      }),
    );

    const outcome = await harness.handler({ documentId: harness.docId });
    expect(outcome).toBe("clean");

    const updated = await harness.catalogRepo.findDocument(harness.tenantId, harness.docId);
    expect(updated).not.toBeNull();
    expect(updated?.processingState).toBe("processing");
    expect(harness.revertedQuotas).toHaveLength(0);
    expect(harness.auditEvents).toHaveLength(0);
  });

  test("AC-46.02: infected file is purged from blob store, catalog, and debited from quota", async () => {
    const harness = createWorkerTestHarness({ scanner: "infected" });
    await harness.blobStore.put(
      harness.blobKey,
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([88, 53, 79]));
          controller.close();
        },
      }),
    );

    const outcome = await harness.handler({ documentId: harness.docId });
    expect(outcome).toBe("infected");

    // Document and blob are deleted completely (AC-46.02)
    const docAfter = await harness.catalogRepo.findDocument(harness.tenantId, harness.docId);
    expect(docAfter).toBeNull();
    expect(harness.blobStore.keys()).not.toContain(harness.blobKey);

    // Quota reverted
    expect(harness.revertedQuotas).toEqual([
      { documentId: harness.docId, tenantId: harness.tenantId, bytes: 1024 },
    ]);

    // Audit event recorded
    expect(harness.auditEvents).toContainEqual({
      tenantId: harness.tenantId,
      actorId: harness.uploaderId,
      action: "malware.detected",
      subjectType: "document",
      subjectId: harness.docId,
      outcome: "denied",
      metadata: {
        filename: "dokumen-uji.pdf",
        signature: "Eicar-Test-Signature",
        sizeBytes: 1024,
      },
    });
  });

  test("idempotency: a ready document is a no-op", async () => {
    const harness = createWorkerTestHarness({ docState: "ready" });
    const outcome = await harness.handler({ documentId: harness.docId });
    expect(outcome).toBe("noop");
  });

  test("a retry finishes cleanup when the signature is already stored", async () => {
    const harness = createWorkerTestHarness({
      docState: "processing",
      signature: "Eicar-Test-Signature",
    });
    expect(await harness.handler({ documentId: harness.docId })).toBe("infected");
    expect(harness.auditEvents).toHaveLength(1);
    expect(harness.revertedQuotas).toHaveLength(1);
  });

  test("missing document returns noop", async () => {
    const harness = createWorkerTestHarness();
    const outcome = await harness.handler({
      documentId: asDocumentId("00000000-0000-0000-0000-000000000000"),
    });
    expect(outcome).toBe("noop");
  });
});
