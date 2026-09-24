import { describe, expect, test } from "bun:test";
import { ApiError } from "../../lib/api.ts";
import { parseUploadBatchBody } from "./api.ts";

describe("document upload batch parsing (FE-S2-01)", () => {
  // AC-01.01: Mengunggah satu file PDF yang valid
  test("AC-01.01: parseUploadBatchBody parses 201 response with accepted document", () => {
    const payload = {
      data: {
        accepted: 1,
        rejected: 0,
        summary: null,
        results: [
          {
            index: 0,
            filename: "laporan.pdf",
            status: "accepted" as const,
            document: {
              id: "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
              title: "laporan.pdf",
              processingState: "queued" as const,
              processingLabel: "Antre",
            },
          },
        ],
      },
    };

    const batch = parseUploadBatchBody(201, payload);
    expect(batch.accepted).toBe(1);
    expect(batch.rejected).toBe(0);
    expect(batch.results).toHaveLength(1);
    expect(batch.results[0]?.status).toBe("accepted");
    if (batch.results[0]?.status === "accepted") {
      expect(batch.results[0].document.title).toBe("laporan.pdf");
    }
  });

  // AC-03.01: Mencoba mengunggah file duplikat (Negative Path)
  test("AC-03.01: parseUploadBatchBody parses 422 per-file outcome carrying existingDocumentId", () => {
    const payload = {
      data: {
        accepted: 0,
        rejected: 1,
        summary: null,
        results: [
          {
            index: 0,
            filename: "laporan-keuangan.pdf",
            status: "rejected" as const,
            error: {
              code: "DUPLICATE_CONTENT",
              message: "File ini sudah ada di sistem",
              existingDocumentId: "11111111-2222-4333-8444-555555555555",
            },
          },
        ],
      },
    };

    const batch = parseUploadBatchBody(422, payload);
    expect(batch.accepted).toBe(0);
    expect(batch.rejected).toBe(1);
    expect(batch.results[0]?.status).toBe("rejected");
    if (batch.results[0]?.status === "rejected") {
      expect(batch.results[0].error.code).toBe("DUPLICATE_CONTENT");
      expect(batch.results[0].error.message).toBe("File ini sudah ada di sistem");
      expect(batch.results[0].error.existingDocumentId).toBe(
        "11111111-2222-4333-8444-555555555555",
      );
    }
  });

  // Mixed batch result (5.2 & AC-35.04)
  test("parseUploadBatchBody handles mixed batch summary", () => {
    const payload = {
      data: {
        accepted: 2,
        rejected: 1,
        summary: "2 dari 3 file berhasil diunggah",
        results: [
          {
            index: 0,
            filename: "doc-1.pdf",
            status: "accepted" as const,
            document: {
              id: "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
              title: "doc-1.pdf",
              processingState: "queued" as const,
              processingLabel: "Antre",
            },
          },
          {
            index: 1,
            filename: "doc-2.docx",
            status: "accepted" as const,
            document: {
              id: "3c7e5b21-9a04-4d18-b6f2-8e0a1c2d3e4f",
              title: "doc-2.docx",
              processingState: "queued" as const,
              processingLabel: "Antre",
            },
          },
          {
            index: 2,
            filename: "doc-3.xlsx",
            status: "rejected" as const,
            error: { code: "QUOTA_EXCEEDED", message: "Kapasitas penyimpanan penuh" },
          },
        ],
      },
    };

    const batch = parseUploadBatchBody(201, payload);
    expect(batch.accepted).toBe(2);
    expect(batch.rejected).toBe(1);
    expect(batch.summary).toBe("2 dari 3 file berhasil diunggah");
  });

  test("parseUploadBatchBody throws ApiError on standard error envelope", () => {
    const errorPayload = {
      error: { code: "BATCH_TOO_LARGE", message: "Maksimal 20 file per unggahan" },
    };

    try {
      parseUploadBatchBody(422, errorPayload);
      expect().fail("should have thrown ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.status).toBe(422);
        expect(err.code).toBe("BATCH_TOO_LARGE");
        expect(err.message).toBe("Maksimal 20 file per unggahan");
      }
    }
  });
});
