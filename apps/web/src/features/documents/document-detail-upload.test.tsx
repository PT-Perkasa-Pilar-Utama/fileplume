import { describe, expect, test } from "bun:test";
import type { DocumentDetailView, DocumentVersionView } from "@archiva/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { DocumentDetailView as DocumentDetailViewComponent } from "./document-detail-view.tsx";

const mockVersion1: DocumentVersionView = {
  id: "aa11b2c3-4d5e-4f60-8a1b-2c3d4e5f6071",
  versionNumber: 1,
  filename: "proposal-v1.pdf",
  sizeBytes: 1048576,
  pageCount: 10,
  uploadedBy: { id: "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", name: "Budi Santoso" },
  createdAt: "2026-09-01T09:00:00.000Z",
  isCurrent: false,
};

const mockVersion2: DocumentVersionView = {
  id: "bb22b2c3-4d5e-4f60-8a1b-2c3d4e5f6072",
  versionNumber: 2,
  filename: "proposal-v2.pdf",
  sizeBytes: 1048576,
  pageCount: 12,
  uploadedBy: { id: "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10", name: "Budi Santoso" },
  createdAt: "2026-09-09T10:15:00.000Z",
  isCurrent: true,
};

const mockDocument: DocumentDetailView = {
  id: "dd11b2c3-4d5e-4f60-8a1b-2c3d4e5f6070",
  title: "Proposal Proyek",
  filename: "proposal-proyek.pdf",
  mimeType: "application/pdf",
  fileType: "pdf",
  sizeBytes: 1048576,
  pageCount: 12,
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
  documentType: "Proposal",
  tags: ["legal"],
  downloadAllowed: true,
  metadata: {
    author: "Budi Santoso",
    documentCreatedAt: "2026-09-01T09:00:00.000Z",
  },
};

describe("DocumentDetailView upload action (FE-S2-06)", () => {
  // AC-21.01: Mengunggah versi baru melalui aksi eksplisit
  test("AC-21.01: renders trigger button, opens upload dialog on click, and closes on cancel", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      },
    });
    queryClient.setQueryData(["document", mockDocument.id], mockDocument);
    queryClient.setQueryData(["document-preview", mockDocument.id, mockVersion2.id], null);

    const rootRoute = createRootRoute({
      component: () => (
        <QueryClientProvider client={queryClient}>
          <DocumentDetailViewComponent documentId={mockDocument.id} />
        </QueryClientProvider>
      ),
    });
    const history = createMemoryHistory({
      initialEntries: [`/documents/${mockDocument.id}`],
    });
    const router = createRouter({ routeTree: rootRoute, history });
    await router.load();

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<RouterProvider router={router} />);
    });

    const triggerButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="upload-new-version-button"]',
    );
    expect(triggerButton).not.toBeNull();
    expect(triggerButton?.textContent).toContain("Unggah Versi Baru");

    expect(container.querySelector('[data-testid="dialog-container"]')).toBeNull();

    await act(async () => {
      triggerButton?.click();
    });

    expect(container.querySelector('[data-testid="dialog-container"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="upload-version-dropzone"]')).not.toBeNull();

    const cancelButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="upload-version-cancel"]',
    );
    expect(cancelButton).not.toBeNull();
    await act(async () => {
      cancelButton?.click();
    });

    expect(container.querySelector('[data-testid="dialog-container"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
