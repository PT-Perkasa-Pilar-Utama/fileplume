import type { FailureReasonView, ProcessingState, ProcessingStatusView } from "@archiva/shared";
import { QueryClient, QueryClientContext, useQuery } from "@tanstack/react-query";
import { useContext, useEffect, useRef } from "react";
import { ApiError } from "../../lib/api.ts";
import { fetchProcessingStatus } from "./api.ts";
import { DOCUMENTS_QUERY_KEY } from "./use-documents.ts";

export const PROCESSING_STATUS_QUERY_KEY: readonly ["document-processing"] = [
  "document-processing",
];
export const DEFAULT_PROCESSING_POLL_INTERVAL_MS = 2_000;

const FALLBACK_QUERY_CLIENT = new QueryClient({
  defaultOptions: { queries: { enabled: false, retry: false } },
});

export interface UseProcessingStatusOptions {
  readonly documentId?: string;
  readonly initialState?: ProcessingState;
  readonly initialLabel?: string;
  readonly initialFailureReason?: FailureReasonView | null;
  readonly enabled?: boolean;
  readonly refetchIntervalMs?: number;
  readonly onStatusChange?: (status: ProcessingStatusView) => void;
}

export interface UseProcessingStatusReturn {
  readonly status: ProcessingStatusView | undefined;
  readonly state: ProcessingState | undefined;
  readonly label: string | undefined;
  readonly failureReason: FailureReasonView | null | undefined;
  readonly isPolling: boolean;
  readonly isError: boolean;
  readonly error: ApiError | Error | null;
}

/**
 * Computes refetch interval for processing status.
 * Polling occurs every 2000 ms while moving (queued | processing);
 * stops (false) on terminal states (ready | failed) or when error is 404 (malware purged).
 * api-specs/07-enrichment.md 7.2.
 */
export function computeProcessingRefetchInterval(
  state?: ProcessingState,
  refetchIntervalMs: number = DEFAULT_PROCESSING_POLL_INTERVAL_MS,
  error?: unknown,
): number | false {
  if (error instanceof ApiError && error.status === 404) {
    return false;
  }
  if (state === "queued" || state === "processing") {
    return refetchIntervalMs;
  }
  return false;
}

/**
 * Polling hook for document processing status (AC-44.01, AC-44.03, AC-46.02).
 * Refetches GET /api/v1/documents/:id/processing every 2s until ready or failed.
 * Catches 404 (purged due to malware scan) to stop polling and invalidate documents.
 */
export function useProcessingStatus({
  documentId,
  initialState,
  initialLabel,
  initialFailureReason,
  enabled,
  refetchIntervalMs = DEFAULT_PROCESSING_POLL_INTERVAL_MS,
  onStatusChange,
}: UseProcessingStatusOptions): UseProcessingStatusReturn {
  const contextClient = useContext(QueryClientContext);
  const client = contextClient ?? FALLBACK_QUERY_CLIENT;

  const isPending = initialState === "queued" || initialState === "processing";
  const isEnabled = Boolean(
    contextClient && documentId && (enabled !== undefined ? enabled : isPending),
  );

  const lastNotifiedStateRef = useRef<string | null>(initialState ?? null);
  const hasInvalidatedOn404Ref = useRef<boolean>(false);

  const query = useQuery(
    {
      queryKey: [...PROCESSING_STATUS_QUERY_KEY, documentId],
      queryFn: async (): Promise<ProcessingStatusView> => {
        if (!documentId) throw new Error("Document ID is required");
        return fetchProcessingStatus(documentId);
      },
      enabled: isEnabled,
      refetchInterval: (q) => {
        if (q.state.error instanceof ApiError && q.state.error.status === 404) {
          return false;
        }
        const currentState = q.state.data?.state ?? initialState;
        return computeProcessingRefetchInterval(currentState, refetchIntervalMs, q.state.error);
      },
      retry: (_failureCount, error) => {
        if (error instanceof ApiError && error.status === 404) {
          return false;
        }
        return false;
      },
    },
    client,
  );

  useEffect(() => {
    if (!query.data) return;
    const currentStatus = query.data;
    if (currentStatus.state !== lastNotifiedStateRef.current) {
      lastNotifiedStateRef.current = currentStatus.state;
      onStatusChange?.(currentStatus);
      if (currentStatus.state === "ready" || currentStatus.state === "failed") {
        void client.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
      }
    }
  }, [query.data, onStatusChange, client]);

  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 404) {
      if (!hasInvalidatedOn404Ref.current) {
        hasInvalidatedOn404Ref.current = true;
        void client.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
      }
    }
  }, [query.error, client]);

  const state = query.data?.state ?? initialState;
  const label = query.data?.label ?? initialLabel;
  const failureReason = query.data !== undefined ? query.data.failureReason : initialFailureReason;
  const isPolling = isEnabled && (state === "queued" || state === "processing") && !query.isError;

  return {
    status: query.data,
    state,
    label,
    failureReason,
    isPolling,
    isError: query.isError,
    error: query.error instanceof ApiError || query.error instanceof Error ? query.error : null,
  };
}
