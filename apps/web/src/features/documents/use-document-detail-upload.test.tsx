import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { type DocumentDetailView, type DocumentVersionView, ERROR_MESSAGES } from "@archiva/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ApiError } from "../../lib/api.ts";
import * as storageApi from "../storage/api.ts";
import { type UseDocumentDetailReturn, useDocumentDetail } from "./use-document-detail.ts";
import { DOCUMENTS_QUERY_KEY } from "./use-documents.ts";

const mockVersion1: DocumentVersionView = {
  id: "aa11b2c3-4d5e-4f60-8a1b-2c3d4e5f6071",
  versionNumber: 1,
  filename: "kontrak-kerjasama-v1.pdf",
  sizeBytes: 2400000,
  pageCount: 40,
  uploadedBy: { id: "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", name: "Budi Santoso" },
  createdAt: "2026-09-01T09:00:00.000Z",
  isCurrent: false,
};

const mockVersion2: DocumentVersionView = {
  id: "bb22b2c3-4d5e-4f60-8a1b-2c3d4e5f6072",
  versionNumber: 2,
  filename: "kontrak-kerjasama-v2.pdf",
  sizeBytes: 2411520,
  pageCount: 42,
  uploadedBy: { id: "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", name: "Budi Santoso" },
  createdAt: "2026-09-09T10:15:00.000Z",
  isCurrent: true,
};

const mockDocument: DocumentDetailView = {
  id: "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01",
  title: "Kontrak Kerjasama PT ABC",
  filename: "kontrak-kerjasama.pdf",
  mimeType: "application/pdf",
  fileType: "pdf",
  sizeBytes: 2411520,
  pageCount: 42,
  versionCount: 2,
  versionNumber: 2,
  versions: [mockVersion2, mockVersion1],
  processingState: "ready",
  processingLabel: "Siap",
  failureReason: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  uploader: { id: "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", name: "Budi Santoso" },
  category: {
    id: "cc11b2c3-4d5e-4f60-8a1b-2c3d4e5f6073",
    name: "Legal Corporate",
    isSuggestion: false,
    isSystem: false,
  },
  documentType: "Kontrak Kerjasama",
  tags: ["legal", "mitra-2026"],
  downloadAllowed: true,
  metadata: { author: "Budi Santoso", documentCreatedAt: "2026-03-04T00:00:00.000Z" },
};

describe("useDocumentDetail uploadVersion (FE-S2-06)", () => {
  const fetchSpy = spyOn(globalThis, "fetch");

  afterEach(() => {
    fetchSpy.mockReset();
  });

  // AC-21.01: Mengunggah versi baru melalui aksi eksplisit
  test("AC-21.01: uploadVersion updates query cache, switches version, and refreshes storage", async () => {
    const mockDocId = mockDocument.id;
    const mockInitialDoc: DocumentDetailView = {
      ...mockDocument,
      versionNumber: 1,
      versionCount: 1,
      versions: [mockVersion1],
    };
    const mockUpdatedDoc: DocumentDetailView = {
      ...mockDocument,
      versionNumber: 2,
      versionCount: 2,
      versions: [mockVersion2, mockVersion1],
    };

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      },
    });
    queryClient.setQueryData(["document", mockDocId], mockInitialDoc);
    queryClient.setQueryData(["document-preview", mockDocId, mockVersion1.id], {
      blob: new Blob(["preview"]),
      url: "blob:preview-url",
    });

    const invalidateSpy = spyOn(queryClient, "invalidateQueries");
    const storageSpy = spyOn(storageApi, "invalidateStorage");

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockUpdatedDoc }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    let hookResult: UseDocumentDetailReturn | undefined;

    function TestComponent() {
      hookResult = useDocumentDetail({ documentId: mockDocId });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>,
      );
    });

    expect(hookResult?.document?.versionNumber).toBe(1);

    const revFile = new File(["new revision content"], "kontrak-kerjasama-v2.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await hookResult?.uploadVersion(revFile);
    });

    expect(hookResult?.document?.versionNumber).toBe(2);
    expect(hookResult?.activeVersion?.id).toBe(mockVersion2.id);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: DOCUMENTS_QUERY_KEY });
    expect(storageSpy).toHaveBeenCalledWith(queryClient);

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
    storageSpy.mockRestore();
  });

  // AC-21.03: Menolak versi baru dengan konten identik (Negative Path)
  test("AC-21.03: uploadVersion rejects on 409 IDENTICAL_CONTENT without modifying document version", async () => {
    const mockDocId = mockDocument.id;
    const mockInitialDoc: DocumentDetailView = {
      ...mockDocument,
      versionNumber: 1,
      versionCount: 1,
      versions: [mockVersion1],
    };

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      },
    });
    queryClient.setQueryData(["document", mockDocId], mockInitialDoc);
    queryClient.setQueryData(["document-preview", mockDocId, mockVersion1.id], {
      blob: new Blob(["preview"]),
      url: "blob:preview-url",
    });

    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "IDENTICAL_CONTENT",
            message: ERROR_MESSAGES.IDENTICAL_CONTENT,
          },
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    let hookResult: UseDocumentDetailReturn | undefined;

    function TestComponent() {
      hookResult = useDocumentDetail({ documentId: mockDocId });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>,
      );
    });

    const identicalFile = new File(["identical"], "kontrak-kerjasama-v1.pdf", {
      type: "application/pdf",
    });

    let caughtError: unknown = null;
    await act(async () => {
      try {
        await hookResult?.uploadVersion(identicalFile);
      } catch (err) {
        caughtError = err;
      }
    });

    expect(caughtError).toBeInstanceOf(ApiError);
    if (!(caughtError instanceof ApiError)) {
      throw new Error("Expected caughtError to be ApiError");
    }
    expect(caughtError.code).toBe("IDENTICAL_CONTENT");
    expect(caughtError.message).toBe("Isi file sama dengan versi yang sudah ada");

    expect(hookResult?.document?.versionNumber).toBe(1);

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  });
});
