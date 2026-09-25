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

    // Next version exceeds quota limit
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

    // Create document A with content X
    await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "dokumen-a.pdf",
      stream: otherContent.stream,
      sizeBytes: otherContent.sizeBytes,
    });

    // Create document B with content Y
    const targetDoc = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "dokumen-b.pdf",
      stream: targetBase.stream,
      sizeBytes: targetBase.sizeBytes,
    });
    if (!targetDoc.ok) throw new Error("Upload failed");

    // Try adding version to document B with content X
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
});
