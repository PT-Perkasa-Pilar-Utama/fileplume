import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { DocumentView } from "@archiva/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useDocuments } from "./use-documents.ts";

const MOCK_DOC: DocumentView = {
  id: "3c7e5b21-9a04-4d18-b6f2-8e0a1c2d3e4f",
  title: "dokumen-analisis.pdf",
  filename: "dokumen-analisis.pdf",
  mimeType: "application/pdf",
  fileType: "pdf",
  sizeBytes: 2048,
  pageCount: 5,
  versionNumber: 1,
  versionCount: 1,
  processingState: "ready",
  processingLabel: "Siap",
  failureReason: null,
  uploader: {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    name: "Dewi Lestari",
  },
  category: null,
  documentType: null,
  tags: [],
  downloadAllowed: true,
  createdAt: "2026-09-01T10:00:00.000Z",
};

let fetchSpy: ReturnType<typeof spyOn>;

describe("useDocuments hook (AC-38.01)", () => {
  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  test("AC-38.01: fetches documents and updates query data", async () => {
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

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    let hookResult: ReturnType<typeof useDocuments> | undefined;

    function TestComp(): null {
      hookResult = useDocuments();
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(TestComp),
        ),
      );
    });

    // Wait for the query to settle
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(hookResult?.isSuccess).toBe(true);
    expect(hookResult?.data?.data).toHaveLength(1);
    expect(hookResult?.data?.data[0]?.id).toBe(MOCK_DOC.id);

    act(() => {
      root.unmount();
    });
  });
});
