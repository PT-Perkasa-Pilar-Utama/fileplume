import { describe, expect, test } from "bun:test";
import {
  createTestHarness,
  PENDING_DAYS,
  pdfStream,
  TENANT_ID,
  USER_ID,
  VIEWER,
} from "./testing/test-harness.ts";

describe("document versioning (BE-S2-04)", () => {
  test("AC-21.01: uploading a new version with different content assigns v2 and keeps single document in list", async () => {
    const { service, repository, enqueuedJobs, committedReservations, auditEvents } =
      createTestHarness();
    const v1File = pdfStream("proposal versi satu");

    const uploadRes = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "proposal.pdf",
      stream: v1File.stream,
      sizeBytes: v1File.sizeBytes,
    });
    expect(uploadRes.ok).toBe(true);
    if (!uploadRes.ok) return;

    const documentId = uploadRes.value.id;
    const v2File = pdfStream("proposal versi dua revisi");

    const versionRes = await service.addVersion(
      documentId,
      {
        tenantId: TENANT_ID,
        uploaderId: USER_ID,
        filename: "proposal.pdf",
        stream: v2File.stream,
        sizeBytes: v2File.sizeBytes,
      },
      VIEWER,
      PENDING_DAYS,
    );

    expect(versionRes.ok).toBe(true);
    if (!versionRes.ok) return;

    // AC-21.01: System assigns v2 and 1 document item remains in list.
    expect(versionRes.value.versionNumber).toBe(2);
    expect(versionRes.value.versionCount).toBe(2);
    expect(repository.documents).toHaveLength(1);
    expect(repository.versions).toHaveLength(2);
    expect(enqueuedJobs).toContain(documentId);
    expect(committedReservations).toHaveLength(2);

    const versionAddAudit = auditEvents.find(
      (e) =>
        typeof e === "object" && e !== null && "action" in e && e.action === "document.version_add",
    );
    expect(versionAddAudit).toBeDefined();
  });

  test("AC-21.02: old versions can be accessed newest first", async () => {
    const { service } = createTestHarness();
    const v1 = pdfStream("konten versi 1");
    const v2 = pdfStream("konten versi 2");
    const v3 = pdfStream("konten versi 3");

    const initial = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "proposal.pdf",
      stream: v1.stream,
      sizeBytes: v1.sizeBytes,
    });
    if (!initial.ok) throw new Error("Upload failed");
    const docId = initial.value.id;

    await service.addVersion(
      docId,
      {
        tenantId: TENANT_ID,
        uploaderId: USER_ID,
        filename: "proposal.pdf",
        stream: v2.stream,
        sizeBytes: v2.sizeBytes,
      },
      VIEWER,
      PENDING_DAYS,
    );

    await service.addVersion(
      docId,
      {
        tenantId: TENANT_ID,
        uploaderId: USER_ID,
        filename: "proposal.pdf",
        stream: v3.stream,
        sizeBytes: v3.sizeBytes,
      },
      VIEWER,
      PENDING_DAYS,
    );

    const detail = await service.getDocument(TENANT_ID, docId, VIEWER, PENDING_DAYS);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;

    const versions = detail.value.versions;
    // AC-21.02: 3 versions returned, newest first (v3, v2, v1).
    expect(versions).toHaveLength(3);
    expect(versions[0]?.versionNumber).toBe(3);
    expect(versions[0]?.isCurrent).toBe(true);
    expect(versions[1]?.versionNumber).toBe(2);
    expect(versions[1]?.isCurrent).toBe(false);
    expect(versions[2]?.versionNumber).toBe(1);
    expect(versions[2]?.isCurrent).toBe(false);
  });

  test("AC-21.03: identical content against the current version is rejected with IdenticalContent", async () => {
    const { service, repository, releasedReservations } = createTestHarness();
    const identicalText = "konten proposal tetap sama persis";
    const file1 = pdfStream(identicalText);
    const file2 = pdfStream(identicalText);

    const initial = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "proposal.pdf",
      stream: file1.stream,
      sizeBytes: file1.sizeBytes,
    });
    if (!initial.ok) throw new Error("Upload failed");
    const docId = initial.value.id;

    const res = await service.addVersion(
      docId,
      {
        tenantId: TENANT_ID,
        uploaderId: USER_ID,
        filename: "proposal.pdf",
        stream: file2.stream,
        sizeBytes: file2.sizeBytes,
      },
      VIEWER,
      PENDING_DAYS,
    );

    // AC-21.03: Negative path returns IdenticalContent and no new version is created.
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe("IdenticalContent");
    expect(repository.versions).toHaveLength(1);
    expect(releasedReservations).toHaveLength(1);
  });

  test("AC-21.04: two concurrent version uploads receive consecutive version numbers", async () => {
    const { service, repository } = createTestHarness();
    const base = pdfStream("konten dasar dokumen");

    const initial = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "proposal.pdf",
      stream: base.stream,
      sizeBytes: base.sizeBytes,
    });
    if (!initial.ok) throw new Error("Upload failed");
    const docId = initial.value.id;

    const fileA = pdfStream("konten dari user A berbeda");
    const fileB = pdfStream("konten dari user B berbeda juga");

    const [resA, resB] = await Promise.all([
      service.addVersion(
        docId,
        {
          tenantId: TENANT_ID,
          uploaderId: USER_ID,
          filename: "proposal.pdf",
          stream: fileA.stream,
          sizeBytes: fileA.sizeBytes,
        },
        VIEWER,
        PENDING_DAYS,
      ),
      service.addVersion(
        docId,
        {
          tenantId: TENANT_ID,
          uploaderId: USER_ID,
          filename: "proposal.pdf",
          stream: fileB.stream,
          sizeBytes: fileB.sizeBytes,
        },
        VIEWER,
        PENDING_DAYS,
      ),
    ]);

    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);
    expect(repository.versions).toHaveLength(3);

    const versionNumbers = repository.versions
      .filter((v) => v.documentId === docId)
      .map((v) => v.versionNumber)
      .sort((a, b) => a - b);

    // Consecutive integers per document with no gap and no duplicate under concurrency.
    expect(versionNumbers).toEqual([1, 2, 3]);
  });

  test("new version resets processing_state to queued and clears failure_reason from processing state (06-data-model.md 6.10.1)", async () => {
    const { service, repository } = createTestHarness();
    const initial = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "proposal.pdf",
      stream: pdfStream("konten v1").stream,
      sizeBytes: 1000,
    });
    if (!initial.ok) throw new Error("Upload failed");
    const docId = initial.value.id;

    const doc = repository.documents.find((d) => d.id === docId);
    if (!doc) throw new Error("Document not found");
    doc.processingState = "processing";
    doc.failureReason = "extraction_timeout";
    const docBefore = await service.findDocument(TENANT_ID, docId);
    expect(docBefore?.processingState).toBe("processing");

    const res = await service.addVersion(
      docId,
      {
        tenantId: TENANT_ID,
        uploaderId: USER_ID,
        filename: "proposal.pdf",
        stream: pdfStream("konten v2 baru").stream,
        sizeBytes: 1200,
      },
      VIEWER,
      PENDING_DAYS,
    );
    expect(res.ok).toBe(true);

    const docAfter = await service.findDocument(TENANT_ID, docId);
    expect(docAfter?.processingState).toBe("queued");
    expect(docAfter?.failureReason).toBeNull();
  });
});
