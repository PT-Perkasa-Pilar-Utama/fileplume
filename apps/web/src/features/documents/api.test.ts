import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { API_BASE, ApiError } from "../../lib/api.ts";
import { fetchProcessingStatus, parseUploadBatchBody } from "./api.ts";

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

describe("fetchProcessingStatus (api-specs/07-enrichment.md 7.2, FE-S3-01)", () => {
  const fetchSpy = spyOn(globalThis, "fetch");

  afterEach(() => {
    fetchSpy.mockReset();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  const mockDocId = "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01";

  // AC-44.01: fetchProcessingStatus calls GET /api/v1/documents/:id/processing and parses status view
  test("AC-44.01: fetchProcessingStatus retrieves moving processing status", async () => {
    const mockPayload = {
      data: {
        documentId: mockDocId,
        state: "processing",
        label: "Diproses",
        failureReason: null,
        searchable: false,
        updatedAt: "2026-09-10T05:20:44.000Z",
      },
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchProcessingStatus(mockDocId);

    expect(fetchSpy).toHaveBeenCalledWith(
      `${API_BASE}/documents/${mockDocId}/processing`,
      expect.objectContaining({ credentials: "include" }),
    );
    expect(result.documentId).toBe(mockDocId);
    expect(result.state).toBe("processing");
    expect(result.label).toBe("Diproses");
    expect(result.failureReason).toBeNull();
    expect(result.searchable).toBe(false);
  });

  // AC-44.03, AC-44.04: fetchProcessingStatus parses failed state with failureReason
  test("AC-44.03: fetchProcessingStatus parses failed state with password_protected reason", async () => {
    const mockPayload = {
      data: {
        documentId: mockDocId,
        state: "failed",
        label: "Gagal",
        failureReason: {
          code: "password_protected",
          message: "Dokumen terproteksi password",
        },
        searchable: false,
        updatedAt: "2026-09-10T05:20:44.000Z",
      },
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchProcessingStatus(mockDocId);

    expect(result.state).toBe("failed");
    expect(result.label).toBe("Gagal");
    expect(result.failureReason?.code).toBe("password_protected");
    expect(result.failureReason?.message).toBe("Dokumen terproteksi password");
  });

  // AC-46.02: 404 indicates document purged due to malware or not found
  test("AC-46.02: fetchProcessingStatus throws ApiError on 404 NOT_FOUND", async () => {
    const errorPayload = {
      error: {
        code: "NOT_FOUND",
        message: "Dokumen tidak ditemukan",
      },
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(errorPayload), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    try {
      await fetchProcessingStatus(mockDocId);
      expect().fail("should have thrown ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.status).toBe(404);
        expect(err.code).toBe("NOT_FOUND");
        expect(err.message).toBe("Dokumen tidak ditemukan");
      }
    }
  });
});
