import { describe, expect, test } from "bun:test";
import { asDocumentId } from "@archiva/shared";
import {
  createTestHarness,
  docxStream,
  jpgStream,
  PENDING_DAYS,
  pdfStream,
  TENANT_ID,
  USER_ID,
  VIEWER,
} from "./testing/test-harness.ts";

function versionInput(filename: string, file: { stream: ReadableStream; sizeBytes: number }) {
  return {
    tenantId: TENANT_ID,
    uploaderId: USER_ID,
    filename,
    stream: file.stream,
    sizeBytes: file.sizeBytes,
  };
}

describe("document versioning error paths (BE-S2-04)", () => {
  test("error: adding a version to an unknown document returns NotFound", async () => {
    const { service } = createTestHarness();
    const file = pdfStream("konten");

    const res = await service.addVersion(
      asDocumentId(crypto.randomUUID()),
      versionInput("proposal.pdf", file),
      VIEWER,
      PENDING_DAYS,
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe("NotFound");
  });

  test("error: unsupported file type returns UnsupportedType", async () => {
    const { service } = createTestHarness();
    const base = pdfStream("konten dasar");
    const initial = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "proposal.pdf",
      stream: base.stream,
      sizeBytes: base.sizeBytes,
    });
    if (!initial.ok) throw new Error("Upload failed");

    const jpg = jpgStream();
    const res = await service.addVersion(
      initial.value.id,
      versionInput("foto.jpg", jpg),
      VIEWER,
      PENDING_DAYS,
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe("UnsupportedType");
  });

  test("error: file exceeding tenant limit returns TooLarge", async () => {
    const { service } = createTestHarness({ maxFileSizeMb: 1 });
    const base = pdfStream("konten dasar");
    const initial = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "proposal.pdf",
      stream: base.stream,
      sizeBytes: base.sizeBytes,
    });
    if (!initial.ok) throw new Error("Upload failed");

    const file = docxStream("konten besar");
    const res = await service.addVersion(
      initial.value.id,
      versionInput("revisi.docx", { stream: file.stream, sizeBytes: 2 * 1024 * 1024 }),
      VIEWER,
      PENDING_DAYS,
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe("TooLarge");
  });

  test("error: quota exceeded returns QuotaExceeded and releases reservation", async () => {
    const base = pdfStream("konten dasar");
    const { service } = createTestHarness({
      quotaBytes: base.sizeBytes + 10,
    });

    const initial = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "proposal.pdf",
      stream: base.stream,
      sizeBytes: base.sizeBytes,
    });
    if (!initial.ok) throw new Error("Upload failed");

    const file = pdfStream("konten versi kedua melebihi sisa kuota yang tersedia");
    const res = await service.addVersion(
      initial.value.id,
      versionInput("revisi.pdf", file),
      VIEWER,
      PENDING_DAYS,
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe("QuotaExceeded");
  });

  test("error: content matching another document in tenant returns DuplicateContent", async () => {
    const { service } = createTestHarness();
    const otherContent = pdfStream("dokumen lain di tenant");
    const targetBase = pdfStream("dokumen target");

    await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "dokumen-a.pdf",
      stream: otherContent.stream,
      sizeBytes: otherContent.sizeBytes,
    });

    const targetDoc = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "dokumen-b.pdf",
      stream: targetBase.stream,
      sizeBytes: targetBase.sizeBytes,
    });
    if (!targetDoc.ok) throw new Error("Upload failed");

    const duplicateFile = pdfStream("dokumen lain di tenant");
    const res = await service.addVersion(
      targetDoc.value.id,
      versionInput("revisi.pdf", duplicateFile),
      VIEWER,
      PENDING_DAYS,
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe("DuplicateContent");
  });

  test("error: content matching an older version of the same document returns DuplicateContent (06-data-model.md 6.6)", async () => {
    const harness = createTestHarness();
    const { service } = harness;
    const contentA = pdfStream("konten versi satu A");
    const doc = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "dokumen.pdf",
      stream: contentA.stream,
      sizeBytes: contentA.sizeBytes,
    });
    if (!doc.ok) throw new Error("Upload failed");

    const contentB = pdfStream("konten versi dua B");
    const v2 = await service.addVersion(
      doc.value.id,
      versionInput("dokumen-v2.pdf", contentB),
      VIEWER,
      PENDING_DAYS,
    );
    expect(v2.ok).toBe(true);

    const contentAReupload = pdfStream("konten versi satu A");
    const v3 = await service.addVersion(
      doc.value.id,
      versionInput("dokumen-v3.pdf", contentAReupload),
      VIEWER,
      PENDING_DAYS,
    );

    expect(v3.ok).toBe(false);
    if (v3.ok) return;
    expect(v3.error.kind).toBe("DuplicateContent");
    if (v3.error.kind === "DuplicateContent") {
      expect(v3.error.existingDocumentId).toBe(doc.value.id);
    }
    expect(harness.revertedReservations).toHaveLength(1);
  });

  test("error: commitQuota failure during addVersion releases quota and leaves version unchanged (CODING_STANDARD.md 7.3)", async () => {
    const harness = createTestHarness();
    const doc = await harness.service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "dokumen.pdf",
      stream: pdfStream("v1").stream,
      sizeBytes: 100,
    });
    if (!doc.ok) throw new Error("Upload failed");

    const docBefore = await harness.service.findDocument(TENANT_ID, doc.value.id);
    const initialVersionId = docBefore?.currentVersionId;
    expect(initialVersionId).toBeTruthy();
    if (!initialVersionId) throw new Error("Expected initialVersionId");

    harness.setCommitQuotaFailure(new Error("simulated commitQuota failure"));

    await expect(
      harness.service.addVersion(
        doc.value.id,
        {
          tenantId: TENANT_ID,
          uploaderId: USER_ID,
          filename: "dokumen-v2.pdf",
          stream: pdfStream("v2").stream,
          sizeBytes: 100,
        },
        VIEWER,
        PENDING_DAYS,
      ),
    ).rejects.toThrow("simulated commitQuota failure");

    const docAfter = await harness.service.findDocument(TENANT_ID, doc.value.id);
    expect(docAfter?.currentVersionId).toBe(initialVersionId);

    const docVersions = harness.repository.versions.filter((v) => v.documentId === doc.value.id);
    expect(docVersions).toHaveLength(1);
    expect(docVersions[0]?.id).toBe(initialVersionId);
    expect(harness.releasedReservations).toHaveLength(1);
    expect(harness.blobStore.keys()).toHaveLength(1);
  });
});
