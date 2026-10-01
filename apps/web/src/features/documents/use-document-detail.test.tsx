import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { type DocumentDetailView, type DocumentVersionView, ERROR_MESSAGES } from "@archiva/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type JSX } from "react";
import { createRoot } from "react-dom/client";
import { ApiError } from "../../lib/api.ts";
import * as detailApi from "./detail-api.ts";
import { type UseDocumentDetailReturn, useDocumentDetail } from "./use-document-detail.ts";

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
  metadata: { author: "Sari Dewi", documentCreatedAt: "2026-09-01T09:00:00.000Z" },
  versions: [mockVersion2, mockVersion1],
};

describe("useDocumentDetail hook (AC-21.02)", () => {
  let hookReturn: UseDocumentDetailReturn | undefined;
  const activeSpies: Array<{ mockRestore: () => void }> = [];

  function HookConsumer({ documentId }: { readonly documentId: string }): JSX.Element | null {
    const value = useDocumentDetail({ documentId });
    hookReturn = value;
    return null;
  }

  afterEach(() => {
    hookReturn = undefined;
    for (const spy of activeSpies) {
      spy.mockRestore();
    }
    activeSpies.length = 0;
  });

  // AC-21.02: switching to v1 updates active version and sends v1 on download
  test("selectVersion(v1) updates active version and directs download to v1.id", async () => {
    const fetchDetailSpy = spyOn(detailApi, "fetchDocumentDetail").mockResolvedValue(mockDocument);
    const fetchPreviewSpy = spyOn(detailApi, "fetchDocumentPreview").mockResolvedValue({
      blob: new Blob(["preview"]),
      url: "blob:mock-url",
    });
    const downloadSpy = spyOn(detailApi, "downloadDocumentRequest").mockResolvedValueOnce({
      blob: new Blob(["v1 content"]),
      filename: "kontrak-kerjasama-v1.pdf",
    });
    const triggerDownloadSpy = spyOn(detailApi, "triggerBlobDownload").mockImplementation(() => {});
    activeSpies.push(fetchDetailSpy, fetchPreviewSpy, downloadSpy, triggerDownloadSpy);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(["document", mockDocument.id], mockDocument);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <HookConsumer documentId={mockDocument.id} />
        </QueryClientProvider>,
      );
    });

    expect(hookReturn?.activeVersion?.id).toBe(mockVersion2.id);
    expect(hookReturn?.activeVersion?.versionNumber).toBe(2);

    await act(async () => {
      hookReturn?.selectVersion(mockVersion1);
    });

    expect(hookReturn?.activeVersion?.id).toBe(mockVersion1.id);
    expect(hookReturn?.activeVersion?.versionNumber).toBe(1);

    await act(async () => {
      await hookReturn?.handleDownload();
    });

    expect(downloadSpy).toHaveBeenCalledWith(
      mockDocument.id,
      mockVersion1.id,
      mockVersion1.filename,
    );

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  });
});

describe("useDocumentDetail hook (FE-S2-06)", () => {
  const fetchSpy = spyOn(globalThis, "fetch");

  afterEach(() => {
    fetchSpy.mockReset();
  });

  // AC-21.01: Mengunggah versi baru melalui aksi eksplisit
  test("AC-21.01: uploadVersion updates document query data and invalidates list query", async () => {
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

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockUpdatedDoc }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockUpdatedDoc }), {
        status: 200,
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

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["document", mockDocId] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["documents"] });

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  });

  // AC-21.03: Menolak versi baru dengan konten identik (Negative Path)
  test("AC-21.03: uploadVersion handles 409 rejection and sets uploadVersionError", async () => {
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
    expect(hookResult?.uploadVersionError).toBe("Isi file sama dengan versi yang sudah ada");

    expect(hookResult?.document?.versionNumber).toBe(1);

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  });
});
