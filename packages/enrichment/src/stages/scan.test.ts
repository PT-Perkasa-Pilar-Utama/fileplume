import { describe, expect, test } from "bun:test";
import { asDocumentId, asTenantId, asUserId, asVersionId } from "@archiva/shared";
import type {
  ScanAuditPort,
  ScanBlobStore,
  ScanCatalogRepository,
  ScanQuotaPort,
} from "../ports.ts";
import { AlwaysCleanScanner } from "../testing/always-clean-scanner.ts";
import { AlwaysInfectedScanner } from "../testing/always-infected-scanner.ts";
import { executeScanStage } from "./scan.ts";

function createHarness() {
  const deletedBlobs: string[] = [];
  const deletedDocs: { tenantId: string; documentId: string }[] = [];
  const revertedQuotas: { documentId: string; tenantId: string; bytes: number }[] = [];
  const auditEvents: Array<{
    tenantId: string;
    actorId: string | null;
    action: string;
    subjectType: string;
    subjectId: string | null;
    outcome: string;
    metadata?: Record<string, unknown>;
  }> = [];

  const blobStore: ScanBlobStore = {
    async get(_key: string): Promise<ReadableStream> {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });
    },
    async delete(key: string): Promise<void> {
      deletedBlobs.push(key);
    },
  };

  const catalogRepo: ScanCatalogRepository = {
    async markScanComplete(): Promise<boolean> {
      return true;
    },
    async markMalwareDetected(): Promise<boolean> {
      return true;
    },
    async deleteDocument(tenantId, documentId): Promise<void> {
      deletedDocs.push({ tenantId, documentId });
    },
  };

  const quota: ScanQuotaPort = {
    async revertCommittedDocumentQuota(reservation): Promise<void> {
      revertedQuotas.push(reservation);
    },
  };

  const audit: ScanAuditPort = {
    async record(event): Promise<void> {
      auditEvents.push(event);
    },
  };

  return {
    blobStore,
    catalogRepo,
    quota,
    audit,
    deletedBlobs,
    deletedDocs,
    revertedQuotas,
    auditEvents,
  };
}

describe("executeScanStage (BE-S2-07)", () => {
  const tenantId = asTenantId("11111111-1111-4111-8111-111111111111");
  const documentId = asDocumentId("22222222-2222-4222-8222-222222222222");
  const uploaderId = asUserId("33333333-3333-4333-8333-333333333333");
  const blobKey = `t/${tenantId}/d/${documentId}/v/ver-1`;

  test("AC-46.01: clean file passes scan and is not deleted", async () => {
    const harness = createHarness();
    const result = await executeScanStage({
      tenantId,
      documentId,
      versionId: asVersionId("44444444-4444-4444-8444-444444444444"),
      uploaderId,
      blobKey,
      sizeBytes: 1024,
      filename: "dokumen-bersih.pdf",
      scanner: new AlwaysCleanScanner(),
      blobStore: harness.blobStore,
      catalogRepo: harness.catalogRepo,
      quota: harness.quota,
      audit: harness.audit,
    });

    expect(result).toEqual({ status: "clean" });
    expect(harness.deletedBlobs).toHaveLength(0);
    expect(harness.deletedDocs).toHaveLength(0);
    expect(harness.revertedQuotas).toHaveLength(0);
    expect(harness.auditEvents).toHaveLength(0);
  });

  test("AC-46.02: infected file is detected, purged, and recorded in audit log", async () => {
    const harness = createHarness();
    const result = await executeScanStage({
      tenantId,
      documentId,
      versionId: asVersionId("44444444-4444-4444-8444-444444444444"),
      uploaderId,
      blobKey,
      sizeBytes: 2048,
      filename: "eicar.com",
      scanner: new AlwaysInfectedScanner("Eicar-Test-Signature"),
      blobStore: harness.blobStore,
      catalogRepo: harness.catalogRepo,
      quota: harness.quota,
      audit: harness.audit,
    });

    expect(result).toEqual({ status: "infected", signature: "Eicar-Test-Signature" });
    expect(harness.deletedBlobs).toContain(blobKey);
    expect(harness.deletedDocs).toContainEqual({ tenantId, documentId });
    expect(harness.revertedQuotas).toContainEqual({
      documentId,
      tenantId,
      bytes: 2048,
    });
    expect(harness.auditEvents).toContainEqual({
      tenantId,
      actorId: uploaderId,
      action: "malware.detected",
      subjectType: "document",
      subjectId: documentId,
      outcome: "denied",
      metadata: {
        filename: "eicar.com",
        signature: "Eicar-Test-Signature",
        sizeBytes: 2048,
      },
    });
  });

  test("scanner failure fails closed by propagating the error", async () => {
    const harness = createHarness();
    const failingScanner = {
      async scan(): Promise<{ infected: boolean; signature?: string }> {
        throw new Error("ClamAV socket timeout after 60000ms");
      },
    };

    await expect(
      executeScanStage({
        tenantId,
        documentId,
        versionId: asVersionId("44444444-4444-4444-8444-444444444444"),
        uploaderId,
        blobKey,
        sizeBytes: 1024,
        filename: "test.pdf",
        scanner: failingScanner,
        blobStore: harness.blobStore,
        catalogRepo: harness.catalogRepo,
        quota: harness.quota,
        audit: harness.audit,
      }),
    ).rejects.toThrow("ClamAV socket timeout");

    expect(harness.deletedBlobs).toHaveLength(0);
    expect(harness.deletedDocs).toHaveLength(0);
  });
});
