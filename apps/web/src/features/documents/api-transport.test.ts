import { describe, expect, test } from "bun:test";
import { ERROR_MESSAGES, type UploadBatch } from "@archiva/shared";
import { ApiError } from "../../lib/api.ts";
import { uploadDocumentsRequest } from "./api.ts";
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

describe("document upload XHR transport (FE-S2-01)", () => {
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
