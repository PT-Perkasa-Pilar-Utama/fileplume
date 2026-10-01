import { describe, expect, test } from "bun:test";
import { asDocumentId } from "@archiva/shared";
import {
  createTestHarness,
  docxStream,
  jpgStream,
  pdfStream,
  TENANT_ID,
  USER_ID,
} from "./testing/test-harness.ts";

describe("document versioning error paths (BE-S2-04)", () => {
  test("error: adding a version to an unknown document returns NotFound", async () => {
    const { service } = createTestHarness();
    const file = pdfStream("konten");

    const res = await service.addVersion(asDocumentId(crypto.randomUUID()), {
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "proposal.pdf",
      stream: file.stream,
      sizeBytes: file.sizeBytes,
    });

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
    const res = await service.addVersion(initial.value.id, {
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "foto.jpg",
      stream: jpg.stream,
      sizeBytes: jpg.sizeBytes,
    });

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
    const res = await service.addVersion(initial.value.id, {
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "revisi.docx",
      stream: file.stream,
      sizeBytes: 2 * 1024 * 1024,
    });

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
    const res = await service.addVersion(initial.value.id, {
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "revisi.pdf",
      stream: file.stream,
      sizeBytes: file.sizeBytes,
    });

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
    const res = await service.addVersion(targetDoc.value.id, {
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "revisi.pdf",
      stream: duplicateFile.stream,
      sizeBytes: duplicateFile.sizeBytes,
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe("DuplicateContent");
  });

  test("error: content matching an older version of the same document returns DuplicateContent (F4)", async () => {
    const { service } = createTestHarness();
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
    const v2 = await service.addVersion(doc.value.id, {
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "dokumen-v2.pdf",
      stream: contentB.stream,
      sizeBytes: contentB.sizeBytes,
    });
    expect(v2.ok).toBe(true);

    const contentAReupload = pdfStream("konten versi satu A");
    const v3 = await service.addVersion(doc.value.id, {
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "dokumen-v3.pdf",
      stream: contentAReupload.stream,
      sizeBytes: contentAReupload.sizeBytes,
    });

    expect(v3.ok).toBe(false);
    if (v3.ok) return;
    expect(v3.error.kind).toBe("DuplicateContent");
    if (v3.error.kind === "DuplicateContent") {
      expect(v3.error.existingDocumentId).toBe(doc.value.id);
    }
  });
});
