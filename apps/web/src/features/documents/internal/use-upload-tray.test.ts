import { describe, expect, test } from "bun:test";
import { ERROR_MESSAGES, type UploadBatch } from "@archiva/shared";
import { applyBatchOutcomeToItems, processFilesForUpload } from "./use-upload-tray.ts";

describe("processFilesForUpload pre-checks & batch preparation (FE-S2-01)", () => {
  // AC-01.05: Melebihi batas jumlah file sekaligus (Negative Path)
  test("AC-01.05: rejects batch exceeding 20 files with exact Indonesian message", () => {
    const files: File[] = [];
    for (let i = 0; i < 25; i++) {
      files.push(new File(["content"], `doc-${i}.pdf`, { type: "application/pdf" }));
    }

    const result = processFilesForUpload(files);
    expect(result.batchError).toBe("Maksimal 20 file per unggahan");
    expect(result.batchError).toBe(ERROR_MESSAGES.BATCH_TOO_LARGE);
    expect(result.filesToUpload).toHaveLength(0);
    expect(result.newItems).toHaveLength(0);
  });

  // AC-01.03: Mencoba mengunggah file tipe tidak didukung (Negative Path)
  test("AC-01.03: marks unsupported file as rejected immediately without queuing for upload", () => {
    const jpgFile = new File(["dummy-img"], "invoice.jpg", { type: "image/jpeg" });
    const result = processFilesForUpload([jpgFile]);

    expect(result.batchError).toBeUndefined();
    expect(result.filesToUpload).toHaveLength(0);
    expect(result.newItems).toHaveLength(1);

    const item = result.newItems[0];
    expect(item?.status).toBe("rejected");
    expect(item?.error?.code).toBe("UNSUPPORTED_TYPE");
    expect(item?.error?.message).toBe(
      "Tipe file tidak didukung. Tipe yang diterima: PDF, DOCX, XLSX, TXT",
    );
  });

  // AC-01.06: Melebihi batas ukuran file (Negative Path)
  test("AC-01.06: marks file exceeding max file size limit as rejected without queuing", () => {
    const oversizedFile = new File(["dummy"], "laporan-25mb.pdf", { type: "application/pdf" });
    Object.defineProperty(oversizedFile, "size", { value: 25 * 1024 * 1024 });

    const result = processFilesForUpload([oversizedFile], 20);
    expect(result.filesToUpload).toHaveLength(0);
    expect(result.newItems).toHaveLength(1);

    const item = result.newItems[0];
    expect(item?.status).toBe("rejected");
    expect(item?.error?.code).toBe("FILE_TOO_LARGE");
    expect(item?.error?.message).toBe("Ukuran file melebihi batas 20 MB");
  });

  // AC-01.01 & AC-01.04: Valid files prepared for upload
  test("AC-01.01 & AC-01.04: queues valid files in uploading state with initial 0% progress", () => {
    const files = [
      new File(["pdf"], "laporan.pdf", { type: "application/pdf" }),
      new File(["docx"], "surat.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ];

    const result = processFilesForUpload(files);
    expect(result.batchError).toBeUndefined();
    expect(result.filesToUpload).toHaveLength(2);
    expect(result.newItems).toHaveLength(2);
    expect(result.newItems.every((item) => item.status === "uploading")).toBe(true);
    expect(result.newItems.every((item) => item.progress === 0)).toBe(true);
  });

  test("handles mixed batch of valid and invalid files cleanly", () => {
    const files = [
      new File(["valid"], "doc-valid.pdf", { type: "application/pdf" }),
      new File(["invalid"], "image.jpg", { type: "image/jpeg" }),
    ];

    const result = processFilesForUpload(files);
    expect(result.filesToUpload).toHaveLength(1);
    expect(result.newItems).toHaveLength(2);

    expect(result.newItems[0]?.filename).toBe("doc-valid.pdf");
    expect(result.newItems[0]?.status).toBe("uploading");

    expect(result.newItems[1]?.filename).toBe("image.jpg");
    expect(result.newItems[1]?.status).toBe("rejected");
    expect(result.newItems[1]?.error?.code).toBe("UNSUPPORTED_TYPE");
  });
});

describe("applyBatchOutcomeToItems mapping (FE-S2-01)", () => {
  // AC-01.01: Progress mencapai 100% dan status diterima
  test("AC-01.01: applies accepted batch result setting progress to 100% and document metadata", () => {
    const file = new File(["content"], "laporan.pdf", { type: "application/pdf" });
    const processed = processFilesForUpload([file], 20, 1000);

    const batch: UploadBatch = {
      accepted: 1,
      rejected: 0,
      summary: null,
      results: [
        {
          index: 0,
          filename: "laporan.pdf",
          status: "accepted",
          document: {
            id: "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
            title: "laporan.pdf",
            processingState: "queued",
            processingLabel: "Antre",
          },
        },
      ],
    };

    const updated = applyBatchOutcomeToItems(processed.newItems, batch, processed.filesToUpload);
    expect(updated).toHaveLength(1);

    const item = updated[0];
    expect(item?.status).toBe("accepted");
    expect(item?.progress).toBe(100);
    expect(item?.document?.id).toBe("0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01");
    expect(item?.document?.title).toBe("laporan.pdf");
  });

  // AC-03.01: Mencoba mengunggah file duplikat (Negative Path)
  test("AC-03.01: applies duplicate content rejection carrying link to existing document", () => {
    const file = new File(["identical"], "laporan-keuangan.pdf", { type: "application/pdf" });
    const processed = processFilesForUpload([file], 20, 2000);

    const existingId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const batch: UploadBatch = {
      accepted: 0,
      rejected: 1,
      summary: null,
      results: [
        {
          index: 0,
          filename: "laporan-keuangan.pdf",
          status: "rejected",
          error: {
            code: "DUPLICATE_CONTENT",
            message: "File ini sudah ada di sistem",
            existingDocumentId: existingId,
          },
        },
      ],
    };

    const updated = applyBatchOutcomeToItems(processed.newItems, batch, processed.filesToUpload);
    expect(updated).toHaveLength(1);

    const item = updated[0];
    expect(item?.status).toBe("rejected");
    expect(item?.error?.code).toBe("DUPLICATE_CONTENT");
    expect(item?.error?.message).toBe("File ini sudah ada di sistem");
    expect(item?.error?.existingDocumentId).toBe(existingId);
  });

  // AC-03.02: Mengunggah file bukan duplikat saat file lain sudah ada
  test("AC-03.02: non-duplicate alongside existing receives accepted status", () => {
    const file = new File(["new"], "presentasi-baru.pdf", { type: "application/pdf" });
    const processed = processFilesForUpload([file], 20, 3000);

    const batch: UploadBatch = {
      accepted: 1,
      rejected: 0,
      summary: null,
      results: [
        {
          index: 0,
          filename: "presentasi-baru.pdf",
          status: "accepted",
          document: {
            id: "new-doc-uuid",
            title: "presentasi-baru.pdf",
            processingState: "queued",
            processingLabel: "Antre",
          },
        },
      ],
    };

    const updated = applyBatchOutcomeToItems(processed.newItems, batch, processed.filesToUpload);
    const item = updated[0];
    expect(item?.status).toBe("accepted");
    expect(item?.progress).toBe(100);
    expect(item?.document?.title).toBe("presentasi-baru.pdf");
  });

  // 5.2 Mixed batch results
  test("maps mixed batch results by index correctly", () => {
    const files = [
      new File(["f1"], "sukses.pdf", { type: "application/pdf" }),
      new File(["f2"], "kuota-penuh.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ];
    const processed = processFilesForUpload(files, 20, 4000);

    const batch: UploadBatch = {
      accepted: 1,
      rejected: 1,
      summary: "1 dari 2 file berhasil diunggah",
      results: [
        {
          index: 0,
          filename: "sukses.pdf",
          status: "accepted",
          document: {
            id: "doc-1",
            title: "sukses.pdf",
            processingState: "queued",
            processingLabel: "Antre",
          },
        },
        {
          index: 1,
          filename: "kuota-penuh.docx",
          status: "rejected",
          error: {
            code: "QUOTA_EXCEEDED",
            message: "Kapasitas penyimpanan penuh",
          },
        },
      ],
    };

    const updated = applyBatchOutcomeToItems(processed.newItems, batch, processed.filesToUpload);
    expect(updated).toHaveLength(2);
    expect(updated[0]?.status).toBe("accepted");
    expect(updated[1]?.status).toBe("rejected");
    expect(updated[1]?.error?.message).toBe("Kapasitas penyimpanan penuh");
  });
});
