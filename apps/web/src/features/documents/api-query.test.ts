import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { type DocumentView, EMPTY_STATE } from "@archiva/shared";
import { buildDocumentSearchParams, fetchDocuments } from "./api.ts";

const MOCK_DOC: DocumentView = {
  id: "3c7e5b21-9a04-4d18-b6f2-8e0a1c2d3e4f",
  title: "laporan-keuangan.pdf",
  filename: "laporan-keuangan.pdf",
  mimeType: "application/pdf",
  fileType: "pdf",
  sizeBytes: 1048576,
  pageCount: 12,
  versionNumber: 1,
  versionCount: 1,
  processingState: "ready",
  processingLabel: "Siap",
  failureReason: null,
  uploader: {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    name: "Ahmad Staff",
  },
  category: {
    id: "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    name: "Finance",
    isSuggestion: false,
    isSystem: false,
  },
  documentType: "Report",
  tags: ["finance", "2026"],
  downloadAllowed: true,
  createdAt: "2026-09-01T10:00:00.000Z",
};

describe("Documents API (AC-38.01, AC-38.03, AC-01.02)", () => {
  const fetchSpy = spyOn(globalThis, "fetch");

  afterEach(() => {
    fetchSpy.mockReset();
  });

  describe("buildDocumentSearchParams", () => {
    test("returns empty string when params is undefined", () => {
      expect(buildDocumentSearchParams()).toBe("");
      expect(buildDocumentSearchParams({})).toBe("");
    });

    test("formats standard pagination and sort query", () => {
      const query = buildDocumentSearchParams({
        page: 2,
        limit: 20,
        sort: "title",
        order: "asc",
      });
      expect(query).toBe("?page=2&limit=20&sort=title&order=asc");
    });

    test("formats repeated query parameters for tags and state", () => {
      const query = buildDocumentSearchParams({
        tags: ["finance", "audit"],
        state: ["ready", "queued"],
        unconfirmedOnly: true,
      });
      expect(query).toContain("tags=finance");
      expect(query).toContain("tags=audit");
      expect(query).toContain("state=ready");
      expect(query).toContain("state=queued");
      expect(query).toContain("unconfirmedOnly=true");
    });
  });

  describe("fetchDocuments", () => {
    // AC-38.01, AC-01.02: Mengambil daftar dokumen
    test("AC-38.01: fetchDocuments calls GET /api/v1/documents and returns collection", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [MOCK_DOC],
            meta: {
              page: 1,
              limit: 10,
              total: 1,
              totalPages: 1,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const result = await fetchDocuments();
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(MOCK_DOC.id);
      expect(result.data[0]?.title).toBe("laporan-keuangan.pdf");
      expect(result.data[0]?.processingLabel).toBe("Siap");
      expect(result.meta.total).toBe(1);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url] = fetchSpy.mock.calls[0] ?? [];
      expect(String(url)).toBe("/api/v1/documents");
    });

    // AC-38.03: Dasbor tanpa dokumen mengembalikan meta.message
    test("AC-38.03: fetchDocuments returns empty collection with server meta.message", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [],
            meta: {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 0,
              message: EMPTY_STATE.NO_DOCUMENTS,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const result = await fetchDocuments();
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.message).toBe(
        "Belum ada dokumen. Seret file ke area unggah untuk memulai",
      );
    });
  });
});
