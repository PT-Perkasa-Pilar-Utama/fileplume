import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { ERROR_MESSAGES } from "@archiva/shared";
import { ApiError } from "../../lib/api.ts";
import {
  fetchDocumentDetail,
  fetchDocumentVersions,
  parseContentDispositionFilename,
} from "./detail-api.ts";

describe("detail-api utilities", () => {
  describe("parseContentDispositionFilename", () => {
    test("parses standard quoted filename", () => {
      expect(parseContentDispositionFilename('attachment; filename="laporan.pdf"')).toBe(
        "laporan.pdf",
      );
    });

    test("parses unquoted filename", () => {
      expect(parseContentDispositionFilename("attachment; filename=data.xlsx")).toBe("data.xlsx");
    });

    test("parses UTF-8 encoded filename", () => {
      expect(
        parseContentDispositionFilename("attachment; filename*=UTF-8''kontrak%20kerjasama.pdf"),
      ).toBe("kontrak kerjasama.pdf");
    });

    test("returns null for null, undefined, or missing filename", () => {
      expect(parseContentDispositionFilename(null)).toBeNull();
      expect(parseContentDispositionFilename(undefined)).toBeNull();
      expect(parseContentDispositionFilename("attachment")).toBeNull();
    });
  });
});

describe("detail-api document and versions", () => {
  const fetchSpy = spyOn(globalThis, "fetch");

  afterEach(() => {
    fetchSpy.mockReset();
  });

  const mockDocId = "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01";
  const mockVersionId = "aa11b2c3-4d5e-4f60-8a1b-2c3d4e5f6071";

  describe("fetchDocumentDetail", () => {
    test("fetches and parses document detail successfully", async () => {
      const mockPayload = {
        data: {
          id: mockDocId,
          title: "kontrak-kerjasama.pdf",
          filename: "kontrak-kerjasama.pdf",
          mimeType: "application/pdf",
          fileType: "pdf",
          sizeBytes: 2411520,
          pageCount: 42,
          versionNumber: 2,
          versionCount: 2,
          processingState: "ready",
          processingLabel: "Siap",
          failureReason: null,
          uploader: {
            id: "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10",
            name: "Budi Santoso",
          },
          category: {
            id: "7b2f0c93-1d84-4a6e-9b52-6c7d8e9f0a1b",
            name: "Technical Spec",
            isSuggestion: false,
            isSystem: false,
          },
          documentType: "Kontrak",
          tags: ["legal", "kerjasama", "2026"],
          downloadAllowed: true,
          metadata: {
            author: "Sari Dewi",
            documentCreatedAt: "2026-03-04T00:00:00.000Z",
          },
          versions: [
            {
              id: mockVersionId,
              versionNumber: 2,
              filename: "kontrak-kerjasama-rev.pdf",
              sizeBytes: 2411520,
              pageCount: 42,
              uploadedBy: {
                id: "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10",
                name: "Budi Santoso",
              },
              createdAt: "2026-09-09T10:15:00.000Z",
              isCurrent: true,
            },
          ],
          createdAt: "2026-09-01T09:00:00.000Z",
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchDocumentDetail(mockDocId);
      expect(result.id).toBe(mockDocId);
      expect(result.title).toBe("kontrak-kerjasama.pdf");
      expect(result.metadata?.author).toBe("Sari Dewi");
      expect(result.versions.length).toBe(1);
    });

    test("throws ApiError on 404 NOT_FOUND", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "NOT_FOUND",
              message: ERROR_MESSAGES.NOT_FOUND,
            },
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      let caught: unknown = null;
      try {
        await fetchDocumentDetail("non-existent-id");
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).status).toBe(404);
      expect((caught as ApiError).code).toBe("NOT_FOUND");
    });
  });

  describe("fetchDocumentVersions", () => {
    test("fetches and parses version collection", async () => {
      const mockVersionsPayload = {
        data: [
          {
            id: mockVersionId,
            versionNumber: 2,
            filename: "kontrak-kerjasama-rev.pdf",
            sizeBytes: 2411520,
            pageCount: 42,
            uploadedBy: {
              id: "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10",
              name: "Budi Santoso",
            },
            createdAt: "2026-09-09T10:15:00.000Z",
            isCurrent: true,
          },
        ],
        meta: { total: 1 },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockVersionsPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const versions = await fetchDocumentVersions(mockDocId);
      expect(versions.length).toBe(1);
      expect(versions[0]?.versionNumber).toBe(2);
    });
  });
});
