import { describe, expect, test } from "bun:test";
import { ERROR_MESSAGES, type UploadBatch } from "@archiva/shared";
import { ApiError } from "../../lib/api.ts";
import { parseUploadBatchBody, uploadDocumentsRequest } from "./api.ts";
import type { UploadProgress, UploadTransport } from "./types.ts";

class MockUploadTransport implements UploadTransport {
  static nextBehavior: {
    status?: number;
    responseText?: string;
    shouldFailError?: boolean;
    shouldFailAbort?: boolean;
    simulateProgress?: { loaded: number; total: number };
  } = {};

  open(_method: string, _url: string): void {}
  withCredentials = false;
  upload = {
    addEventListener: (_type: "progress", listener: (ev: ProgressEvent) => void) => {
      this.progressListener = listener;
    },
  };
  private progressListener: ((ev: ProgressEvent) => void) | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 200;
  responseText = "";

  send(_body?: Document | XMLHttpRequestBodyInit | null): void {
    const b = MockUploadTransport.nextBehavior;
    this.status = b.status ?? 200;
    this.responseText = b.responseText ?? "";

    if (b.simulateProgress && this.progressListener) {
      this.progressListener({
        lengthComputable: true,
        loaded: b.simulateProgress.loaded,
        total: b.simulateProgress.total,
      } as unknown as ProgressEvent);
    }

    if (b.shouldFailError) {
      this.onerror?.();
      return;
    }
    if (b.shouldFailAbort) {
      this.onabort?.();
      return;
    }
    this.onload?.();
  }
}

describe("document upload API (FE-S2-01)", () => {
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

  // AC-01.01: Mengunggah satu file PDF yang valid - XHR progress and completion
  test("AC-01.01: uploadDocumentsRequest tracks XHR progress events and completes at 100%", async () => {
    const payload: { data: UploadBatch } = {
      data: {
        accepted: 1,
        rejected: 0,
        summary: null,
        results: [
          {
            index: 0,
            filename: "proposal.pdf",
            status: "accepted",
            document: {
              id: "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
              title: "proposal.pdf",
              processingState: "queued",
              processingLabel: "Antre",
            },
          },
        ],
      },
    };

    MockUploadTransport.nextBehavior = {
      status: 201,
      responseText: JSON.stringify(payload),
      simulateProgress: { loaded: 50, total: 100 },
    };

    const file = new File(["test-content"], "proposal.pdf", { type: "application/pdf" });
    const progressReports: UploadProgress[] = [];

    const batch = await uploadDocumentsRequest([file], {
      transport: MockUploadTransport,
      onProgress: (p) => progressReports.push(p),
    });

    expect(batch.accepted).toBe(1);
    expect(progressReports.length).toBeGreaterThan(1);
    // Intermediate simulated progress
    expect(progressReports[0]?.progress).toBe(50);
    // AC-01.01: indikator progres unggahan mencapai 100 persen
    const lastProgress = progressReports[progressReports.length - 1];
    expect(lastProgress?.progress).toBe(100);
  });

  // AC-01.07: Unggahan terputus di tengah proses (Negative Path)
  test("AC-01.07: uploadDocumentsRequest rejects with UPLOAD_INTERRUPTED on network error", async () => {
    MockUploadTransport.nextBehavior = { shouldFailError: true };
    const file = new File(["test-content"], "broken.pdf", { type: "application/pdf" });

    try {
      await uploadDocumentsRequest([file], { transport: MockUploadTransport });
      expect().fail("should have thrown ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.status).toBe(400);
        expect(err.code).toBe("UPLOAD_INTERRUPTED");
        expect(err.message).toBe(ERROR_MESSAGES.UPLOAD_INTERRUPTED);
      }
    }
  });

  // AC-01.07: Unggahan terputus via abort
  test("AC-01.07: uploadDocumentsRequest rejects with UPLOAD_INTERRUPTED on abort", async () => {
    MockUploadTransport.nextBehavior = { shouldFailAbort: true };
    const file = new File(["test-content"], "aborted.pdf", { type: "application/pdf" });

    try {
      await uploadDocumentsRequest([file], { transport: MockUploadTransport });
      expect().fail("should have thrown ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.status).toBe(400);
        expect(err.code).toBe("UPLOAD_INTERRUPTED");
        expect(err.message).toBe(ERROR_MESSAGES.UPLOAD_INTERRUPTED);
      }
    }
  });

  test("uploadDocumentsRequest rejects with INTERNAL_ERROR on unparseable JSON response", async () => {
    MockUploadTransport.nextBehavior = {
      status: 200,
      responseText: "<html>502 Bad Gateway</html>",
    };
    const file = new File(["test-content"], "test.pdf", { type: "application/pdf" });

    try {
      await uploadDocumentsRequest([file], { transport: MockUploadTransport });
      expect().fail("should have thrown ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.status).toBe(200);
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
      }
    }
  });
});
