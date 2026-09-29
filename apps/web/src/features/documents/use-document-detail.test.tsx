import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { DocumentDetailView, DocumentVersionView } from "@archiva/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type JSX } from "react";
import { createRoot } from "react-dom/client";
import * as detailApi from "./detail-api.ts";
import { type UseDocumentDetailReturn, useDocumentDetail } from "./use-document-detail.ts";

const mockVersion1: DocumentVersionView = {
  id: "version-1-id",
  versionNumber: 1,
  filename: "kontrak-kerjasama-v1.pdf",
  sizeBytes: 2400000,
  pageCount: 40,
  uploadedBy: { id: "user-1", name: "Budi Santoso" },
  createdAt: "2026-09-01T09:00:00.000Z",
  isCurrent: false,
};

const mockVersion2: DocumentVersionView = {
  id: "version-2-id",
  versionNumber: 2,
  filename: "kontrak-kerjasama-v2.pdf",
  sizeBytes: 2411520,
  pageCount: 42,
  uploadedBy: { id: "user-1", name: "Budi Santoso" },
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
  uploader: { id: "user-1", name: "Budi Santoso" },
  category: { id: "cat-1", name: "Legal Corporate", isSuggestion: false, isSystem: false },
  documentType: "Kontrak Kerjasama",
  tags: ["legal", "mitra-2026"],
  downloadAllowed: true,
  metadata: { author: "Sari Dewi", documentCreatedAt: "2026-09-01T09:00:00.000Z" },
  versions: [mockVersion2, mockVersion1],
};

describe("useDocumentDetail hook (AC-21.02)", () => {
  let hookReturn: UseDocumentDetailReturn | undefined;

  function HookConsumer({ documentId }: { readonly documentId: string }): JSX.Element | null {
    const value = useDocumentDetail({ documentId });
    hookReturn = value;
    return null;
  }

  afterEach(() => {
    hookReturn = undefined;
  });

  // AC-21.02: switching to v1 updates active version and sends v1 on download
  test("selectVersion(v1) updates active version and directs download to v1.id", async () => {
    spyOn(detailApi, "fetchDocumentDetail").mockResolvedValue(mockDocument);
    spyOn(detailApi, "fetchDocumentPreview").mockResolvedValue({
      blob: new Blob(["preview"]),
      url: "blob:mock-url",
    });
    const downloadSpy = spyOn(detailApi, "downloadDocumentRequest").mockResolvedValueOnce({
      blob: new Blob(["v1 content"]),
      filename: "kontrak-kerjasama-v1.pdf",
    });
    spyOn(detailApi, "triggerBlobDownload").mockImplementation(() => {});

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
