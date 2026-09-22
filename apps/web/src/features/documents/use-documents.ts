import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { type DocumentQueryParams, type DocumentsResponse, fetchDocuments } from "./api.ts";

export const DOCUMENTS_QUERY_KEY = ["documents"] as const;

export type UseDocumentsResult = UseQueryResult<DocumentsResponse, Error>;

export interface UseDocumentsOptions {
  readonly params?: DocumentQueryParams;
  readonly enabled?: boolean;
}

/**
 * Hook for fetching documents list with TanStack Query.
 * Automatically tracks params in the queryKey.
 */
export function useDocuments(options?: UseDocumentsOptions): UseDocumentsResult {
  const params = options?.params;
  return useQuery<DocumentsResponse, Error>({
    queryKey: [...DOCUMENTS_QUERY_KEY, params],
    queryFn: () => fetchDocuments(params),
    enabled: options?.enabled,
  });
}
