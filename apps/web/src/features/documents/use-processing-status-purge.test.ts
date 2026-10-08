import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { DOCUMENTS_QUERY_KEY } from "./use-documents.ts";
import { useProcessingStatus } from "./use-processing-status.ts";

async function waitForCondition(predicate: () => boolean, timeoutMs = 1_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (!predicate() && Date.now() < deadline) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  return predicate();
}

describe("useProcessingStatus malware purge handling (AC-46.02, spec 7.2)", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  const mockDocId = "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01";

  // AC-46.02 & spec 7.2: 404 response (malware purged) stops polling and invalidates documents list
  test("AC-46.02: 404 response invalidates documents query and stops polling", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: "NOT_FOUND", message: "Dokumen tidak ditemukan" },
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    const invalidateSpy = spyOn(queryClient, "invalidateQueries");

    let hookResult: ReturnType<typeof useProcessingStatus> | undefined;

    function TestComp(): null {
      hookResult = useProcessingStatus({
        documentId: mockDocId,
        initialState: "processing",
        initialLabel: "Diproses",
        refetchIntervalMs: 25,
      });
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

    const purgeHandled = await waitForCondition(
      () => hookResult?.isError === true && invalidateSpy.mock.calls.length > 0,
    );

    expect(purgeHandled).toBe(true);
    expect(hookResult?.isError).toBe(true);
    expect(hookResult?.isPolling).toBe(false);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: DOCUMENTS_QUERY_KEY });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Wait past refetchIntervalMs again to prove polling timer has completely stopped
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });
});
