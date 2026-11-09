import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { DOCUMENTS_QUERY_KEY } from "./use-documents.ts";
import { useProcessingStatus } from "./use-processing-status.ts";

describe("useProcessingStatus hook (FE-S3-01, AC-44.01, AC-44.03, AC-46.02)", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  const mockDocId = "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01";

  // AC-44.01: Polling is enabled and transitions to ready state with server label
  test("AC-44.01: polls status until ready and invalidates documents query", async () => {
    const readyPayload = {
      data: {
        documentId: mockDocId,
        state: "ready",
        label: "Siap",
        failureReason: null,
        searchable: true,
        updatedAt: "2026-09-10T05:20:44.000Z",
      },
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(readyPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
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

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(hookResult?.state).toBe("ready");
    expect(hookResult?.label).toBe("Siap");
    expect(hookResult?.failureReason).toBeNull();
    expect(hookResult?.isPolling).toBe(false);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: DOCUMENTS_QUERY_KEY });

    act(() => {
      root.unmount();
    });
  });

  // AC-44.03: Kegagalan permanen ditandai dengan label Gagal dan failureReason
  test("AC-44.03: handles failed state with failure reason and stops polling", async () => {
    const failedPayload = {
      data: {
        documentId: mockDocId,
        state: "failed",
        label: "Gagal",
        failureReason: {
          code: "password_protected",
          message: "Dokumen terproteksi password",
        },
        searchable: false,
        updatedAt: "2026-09-10T05:20:44.000Z",
      },
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(failedPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    let hookResult: ReturnType<typeof useProcessingStatus> | undefined;

    function TestComp(): null {
      hookResult = useProcessingStatus({
        documentId: mockDocId,
        initialState: "queued",
        initialLabel: "Antre",
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

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(hookResult?.state).toBe("failed");
    expect(hookResult?.label).toBe("Gagal");
    expect(hookResult?.failureReason?.code).toBe("password_protected");
    expect(hookResult?.failureReason?.message).toBe("Dokumen terproteksi password");
    expect(hookResult?.isPolling).toBe(false);

    act(() => {
      root.unmount();
    });
  });

  test("uses initial values when query is not active or disabled", () => {
    let hookResult: ReturnType<typeof useProcessingStatus> | undefined;

    function TestComp(): null {
      hookResult = useProcessingStatus({
        documentId: mockDocId,
        initialState: "ready",
        initialLabel: "Siap",
        enabled: false,
      });
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(React.createElement(TestComp));
    });

    expect(hookResult?.state).toBe("ready");
    expect(hookResult?.label).toBe("Siap");
    expect(hookResult?.isPolling).toBe(false);

    act(() => {
      root.unmount();
    });
  });
});
