import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { ERROR_MESSAGES } from "@archiva/shared";
import {
  downloadDocumentRequest,
  fetchDocumentPreview,
  triggerBlobDownload,
} from "./detail-api.ts";

if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => "blob:mock";
}
if (!globalThis.URL.revokeObjectURL) {
  globalThis.URL.revokeObjectURL = () => {};
}

describe("detail-api preview and download", () => {
  const fetchSpy = spyOn(globalThis, "fetch");

  afterEach(() => {
    fetchSpy.mockReset();
  });

  const mockDocId = "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01";
  const mockVersionId = "aa11b2c3-4d5e-4f60-8a1b-2c3d4e5f6071";

  describe("triggerBlobDownload", () => {
    test("does not throw in test environment", () => {
      const blob = new Blob(["test-content"], { type: "application/pdf" });
      expect(() => triggerBlobDownload(blob, "test.pdf")).not.toThrow();
    });
  });

  describe("fetchDocumentPreview", () => {
    test("returns blob and url for successful preview", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(new Blob(["%PDF-1.4 preview"], { type: "application/pdf" }), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": "inline",
          },
        }),
      );

      const result = await fetchDocumentPreview(mockDocId, mockVersionId);
      expect(result.blob).toBeDefined();
      expect(result.blob.size).toBeGreaterThan(0);
    });

    test("throws typed ApiError for 422 PREVIEW_UNAVAILABLE", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "PREVIEW_UNAVAILABLE",
              message: ERROR_MESSAGES.PREVIEW_UNAVAILABLE,
            },
          }),
          {
            status: 422,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      await expect(fetchDocumentPreview(mockDocId)).rejects.toMatchObject({
        status: 422,
        code: "PREVIEW_UNAVAILABLE",
        message: ERROR_MESSAGES.PREVIEW_UNAVAILABLE,
      });
    });

    // AC-21.02
    test("previewing v1 requests v1 by versionId", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(new Blob(["%PDF"]), { status: 200 }));

      await fetchDocumentPreview(mockDocId, mockVersionId);

      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(`versionId=${mockVersionId}`);
    });
  });

  describe("downloadDocumentRequest", () => {
    test("returns blob and filename from Content-Disposition header", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(new Blob(["file data"]), {
          status: 200,
          headers: {
            "Content-Disposition": 'attachment; filename="unduhan-versi-1.pdf"',
          },
        }),
      );

      const result = await downloadDocumentRequest(mockDocId, mockVersionId, "default.pdf");
      expect(result.filename).toBe("unduhan-versi-1.pdf");
      expect(result.blob).toBeDefined();
    });

    test("throws typed ApiError on 403 DOWNLOAD_FORBIDDEN", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "DOWNLOAD_FORBIDDEN",
              message: ERROR_MESSAGES.DOWNLOAD_FORBIDDEN,
            },
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      await expect(downloadDocumentRequest(mockDocId)).rejects.toMatchObject({
        status: 403,
        code: "DOWNLOAD_FORBIDDEN",
        message: ERROR_MESSAGES.DOWNLOAD_FORBIDDEN,
      });
    });

    // AC-21.02
    test("downloading after choosing v1 requests v1's bytes", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(new Blob(["v1"]), { status: 200 }));

      await downloadDocumentRequest(mockDocId, mockVersionId);

      const [, init] = fetchSpy.mock.calls[0] ?? [];
      expect(JSON.parse(String(init?.body))).toEqual({ versionId: mockVersionId });
    });
  });
});
