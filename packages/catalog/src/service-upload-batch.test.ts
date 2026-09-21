import { describe, expect, test } from "bun:test";
import {
  chunkedPdfStream,
  createTestHarness,
  docxStream,
  jpgStream,
  pdfStream,
  TENANT_ID,
  USER_ID,
} from "./testing/test-harness.ts";

describe("upload batch acceptance criteria", () => {
  test("AC-01.01: single valid PDF is accepted with queued state and Antre label", async () => {
    const { service } = createTestHarness();
    const file = pdfStream("laporan keuangan q3");

    const res = await service.uploadBatch(TENANT_ID, USER_ID, [
      { filename: "laporan.pdf", stream: file.stream, sizeBytes: file.sizeBytes },
    ]);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.accepted).toBe(1);
    expect(res.value.rejected).toBe(0);
    expect(res.value.summary).toBeNull();
    expect(res.value.results[0]?.status).toBe("accepted");
    if (res.value.results[0]?.status === "accepted") {
      expect(res.value.results[0].document.processingState).toBe("queued");
      expect(res.value.results[0].document.processingLabel).toBe("Antre");
      expect(res.value.results[0].document.title).toBe("laporan.pdf");
    }
  });

  test("AC-01.03: unsupported file type (.jpg) is rejected with UNSUPPORTED_TYPE", async () => {
    const { service } = createTestHarness();
    const file = jpgStream();

    const res = await service.uploadBatch(TENANT_ID, USER_ID, [
      { filename: "foto.jpg", stream: file.stream, sizeBytes: file.sizeBytes },
    ]);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.accepted).toBe(0);
    expect(res.value.rejected).toBe(1);
    expect(res.value.results[0]?.status).toBe("rejected");
    if (res.value.results[0]?.status === "rejected") {
      expect(res.value.results[0].error.code).toBe("UNSUPPORTED_TYPE");
      expect(res.value.results[0].error.message).toBe(
        "Tipe file tidak didukung. Tipe yang diterima: PDF, DOCX, XLSX, TXT",
      );
    }
  });

  test("AC-01.04: multiple files (3 DOCX) uploaded in a batch are all accepted", async () => {
    const { service } = createTestHarness();
    const files = [
      { filename: "dokumen-1.docx", ...docxStream("content 1") },
      { filename: "dokumen-2.docx", ...docxStream("content 2") },
      { filename: "dokumen-3.docx", ...docxStream("content 3") },
    ];

    const res = await service.uploadBatch(TENANT_ID, USER_ID, files);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.accepted).toBe(3);
    expect(res.value.rejected).toBe(0);
    expect(res.value.results).toHaveLength(3);
    expect(res.value.results.every((r) => r.status === "accepted")).toBe(true);
  });

  test("AC-01.05: more than 20 files in a batch returns BatchTooLarge", async () => {
    const { service } = createTestHarness();
    const files = Array.from({ length: 25 }, (_, i) => ({
      filename: `doc-${i}.pdf`,
      ...pdfStream(`content ${i}`),
    }));

    const res = await service.uploadBatch(TENANT_ID, USER_ID, files);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("BatchTooLarge");
    }
  });

  test("AC-01.06: file exceeding max_file_size_mb is rejected with FILE_TOO_LARGE", async () => {
    const { service } = createTestHarness({ maxFileSizeMb: 20 });
    const file = pdfStream("oversized content");

    const res = await service.uploadBatch(TENANT_ID, USER_ID, [
      { filename: "berkas-besar.pdf", stream: file.stream, sizeBytes: 25 * 1024 * 1024 },
    ]);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.accepted).toBe(0);
    expect(res.value.rejected).toBe(1);
    const first = res.value.results[0];
    expect(first?.status).toBe("rejected");
    if (first?.status === "rejected") {
      expect(first.error.code).toBe("FILE_TOO_LARGE");
      expect(first.error.message).toBe("Ukuran file melebihi batas 20 MB");
    }
  });

  test("AC-03.01: identical content is rejected with DUPLICATE_CONTENT and a link", async () => {
    const { service, repository, blobStore } = createTestHarness();
    const first = pdfStream("laporan keuangan q3");
    const firstRes = await service.upload({
      tenantId: TENANT_ID,
      uploaderId: USER_ID,
      filename: "laporan-keuangan.pdf",
      stream: first.stream,
      sizeBytes: first.sizeBytes,
    });
    expect(firstRes.ok).toBe(true);
    if (!firstRes.ok) return;

    const retry = pdfStream("laporan keuangan q3");
    const res = await service.uploadBatch(TENANT_ID, USER_ID, [
      { filename: "salinan.pdf", stream: retry.stream, sizeBytes: retry.sizeBytes },
    ]);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.accepted).toBe(0);
    expect(res.value.rejected).toBe(1);
    const outcome = res.value.results[0];
    expect(outcome?.status).toBe("rejected");
    if (outcome?.status === "rejected") {
      expect(outcome.error.code).toBe("DUPLICATE_CONTENT");
      expect(outcome.error.message).toBe("File ini sudah ada di sistem");
      expect(outcome.error.existingDocumentId).toBe(firstRes.value.id);
    }
    expect(repository.documents).toHaveLength(1);
    expect(blobStore.keys()).toHaveLength(1);
  });

  test("AC-35.03: refused quota rejects the file and stores nothing", async () => {
    const { service, repository, blobStore, committedReservations } = createTestHarness({
      quotaAvailable: false,
    });
    const file = pdfStream("laporan kuota");

    const res = await service.uploadBatch(TENANT_ID, USER_ID, [
      { filename: "laporan.pdf", stream: file.stream, sizeBytes: file.sizeBytes },
    ]);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.accepted).toBe(0);
    expect(res.value.rejected).toBe(1);
    const outcome = res.value.results[0];
    expect(outcome?.status).toBe("rejected");
    if (outcome?.status === "rejected") {
      expect(outcome.error.code).toBe("QUOTA_EXCEEDED");
      expect(outcome.error.message).toBe("Kapasitas penyimpanan penuh");
    }
    expect(repository.documents).toHaveLength(0);
    expect(blobStore.keys()).toHaveLength(0);
    expect(committedReservations).toHaveLength(0);
  });

  test("mixed batch formats summary line (AC-35.04)", async () => {
    const { service } = createTestHarness();
    const pdf1 = pdfStream("valid 1");
    const pdf2 = pdfStream("valid 2");
    const invalid = jpgStream();

    const res = await service.uploadBatch(TENANT_ID, USER_ID, [
      { filename: "dok1.pdf", stream: pdf1.stream, sizeBytes: pdf1.sizeBytes },
      { filename: "dok2.pdf", stream: pdf2.stream, sizeBytes: pdf2.sizeBytes },
      { filename: "gambar.jpg", stream: invalid.stream, sizeBytes: invalid.sizeBytes },
    ]);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.accepted).toBe(2);
    expect(res.value.rejected).toBe(1);
    expect(res.value.summary).toBe("2 dari 3 file berhasil diunggah");
  });

  test("sniffing reads past the first chunk, so a dripped stream is accepted", async () => {
    const { service } = createTestHarness();
    const file = chunkedPdfStream();

    const res = await service.uploadBatch(TENANT_ID, USER_ID, [
      { filename: "laporan.pdf", stream: file.stream, sizeBytes: file.sizeBytes },
    ]);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.accepted).toBe(1);
  });
});
