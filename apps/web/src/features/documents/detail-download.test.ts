import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { ERROR_MESSAGES } from "@archiva/shared";
import { ApiError } from "../../lib/api.ts";
import {
  downloadDocumentRequest,
  fetchDocumentPreview,
  triggerBlobDownload,
} from "./detail-api.ts";

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

      let caught: unknown = null;
      try {
        await fetchDocumentPreview(mockDocId);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).status).toBe(422);
      expect((caught as ApiError).code).toBe("PREVIEW_UNAVAILABLE");
      expect((caught as ApiError).message).toBe(ERROR_MESSAGES.PREVIEW_UNAVAILABLE);
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

      let caught: unknown = null;
      try {
        await downloadDocumentRequest(mockDocId);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).status).toBe(403);
      expect((caught as ApiError).code).toBe("DOWNLOAD_FORBIDDEN");
      expect((caught as ApiError).message).toBe(ERROR_MESSAGES.DOWNLOAD_FORBIDDEN);
    });
  });
});
