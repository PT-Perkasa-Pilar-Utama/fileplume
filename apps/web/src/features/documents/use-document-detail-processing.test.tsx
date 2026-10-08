import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { DocumentDetailView, DocumentVersionView } from "@archiva/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type JSX } from "react";
import { createRoot } from "react-dom/client";
import { ApiError } from "../../lib/api.ts";
import * as docApi from "./api.ts";
import * as detailApi from "./detail-api.ts";
import {
  DOCUMENT_QUERY_KEY,
  type UseDocumentDetailReturn,
  useDocumentDetail,
} from "./use-document-detail.ts";

const mockVersion: DocumentVersionView = {
  id: "version-1-id",
  versionNumber: 1,
  filename: "kontrak-kerjasama.pdf",
  sizeBytes: 2411520,
  pageCount: 42,
  uploadedBy: { id: "user-1", name: "Budi Santoso" },
  createdAt: "2026-09-01T09:00:00.000Z",
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
  versionNumber: 1,
  versionCount: 1,
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
  versions: [mockVersion],
};

describe("useDocumentDetail processing status polling (FE-S3-01, AC-44.01, AC-46.02)", () => {
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

  // AC-44.01 & spec 7.2: Detail polling uses lightweight processing status rather than refetching full detail
  test("uses lightweight processing status polling instead of full detail refetch", async () => {
    const processingDoc: DocumentDetailView = {
      ...mockDocument,
      processingState: "processing",
      processingLabel: "Diproses",
    };
    const fetchDetailSpy = spyOn(detailApi, "fetchDocumentDetail").mockResolvedValue(processingDoc);
    const fetchProcessingSpy = spyOn(docApi, "fetchProcessingStatus").mockResolvedValue({
      documentId: processingDoc.id,
      state: "processing",
      label: "Diproses",
      failureReason: null,
      searchable: false,
      updatedAt: "2026-09-01T09:00:00.000Z",
    });
    activeSpies.push(fetchDetailSpy, fetchProcessingSpy);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 60_000 } },
    });
    queryClient.setQueryData([...DOCUMENT_QUERY_KEY, processingDoc.id], processingDoc);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <HookConsumer documentId={processingDoc.id} />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(hookReturn?.document?.processingState).toBe("processing");
    expect(hookReturn?.document?.processingLabel).toBe("Diproses");
    expect(fetchProcessingSpy).toHaveBeenCalledWith(processingDoc.id);
    expect(fetchDetailSpy).toHaveBeenCalledTimes(0);

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  });

  // AC-46.02 & spec 7.2: 404 from processing status (malware purge) marks detail as error 404
  test("handles 404 from processing status by marking document as purged", async () => {
    const processingDoc: DocumentDetailView = {
      ...mockDocument,
      processingState: "processing",
      processingLabel: "Diproses",
    };
    const fetchDetailSpy = spyOn(detailApi, "fetchDocumentDetail").mockResolvedValue(processingDoc);
    const fetchProcessingSpy = spyOn(docApi, "fetchProcessingStatus").mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Dokumen tidak ditemukan"),
    );
    activeSpies.push(fetchDetailSpy, fetchProcessingSpy);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    queryClient.setQueryData([...DOCUMENT_QUERY_KEY, processingDoc.id], processingDoc);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <HookConsumer documentId={processingDoc.id} />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(hookReturn?.isError).toBe(true);
    expect(hookReturn?.error).toBeInstanceOf(ApiError);
    if (hookReturn?.error instanceof ApiError) {
      expect(hookReturn.error.status).toBe(404);
    }
    expect(hookReturn?.document).toBeUndefined();

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  });

  // AC-44.01: Status transition to ready invalidates DOCUMENT_QUERY_KEY to pull enriched detail
  test("invalidates DOCUMENT_QUERY_KEY when processing status reaches ready", async () => {
    const processingDoc: DocumentDetailView = {
      ...mockDocument,
      processingState: "queued",
      processingLabel: "Antre",
    };
    const fetchDetailSpy = spyOn(detailApi, "fetchDocumentDetail").mockResolvedValue(processingDoc);
    const fetchProcessingSpy = spyOn(docApi, "fetchProcessingStatus").mockResolvedValue({
      documentId: processingDoc.id,
      state: "ready",
      label: "Siap",
      failureReason: null,
      searchable: true,
      updatedAt: "2026-09-01T09:00:00.000Z",
    });
    activeSpies.push(fetchDetailSpy, fetchProcessingSpy);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const invalidateSpy = spyOn(queryClient, "invalidateQueries");
    queryClient.setQueryData([...DOCUMENT_QUERY_KEY, processingDoc.id], processingDoc);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <HookConsumer documentId={processingDoc.id} />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [...DOCUMENT_QUERY_KEY, processingDoc.id],
    });

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  });
});
