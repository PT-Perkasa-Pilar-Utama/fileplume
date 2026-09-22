import { dataOf, type StorageView, storageSchema } from "@archiva/shared";
import {
  type QueryClient,
  queryOptions,
  type UndefinedInitialDataOptions,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";
import { apiFetch } from "../../lib/api.ts";

/**
 * GET /api/v1/storage
 * api-specs/04-configuration.md 4.5
 * Reports committed usage, not usage plus outstanding reservations.
 */
export async function fetchStorage(): Promise<StorageView> {
  const response = await apiFetch("/storage", dataOf(storageSchema));
  return response.data;
}

export const STORAGE_QUERY_KEY = ["storage"] as const;

export function storageQueryOptions(
  enabled = true,
): UndefinedInitialDataOptions<StorageView, Error, StorageView, typeof STORAGE_QUERY_KEY> {
  return queryOptions({
    queryKey: STORAGE_QUERY_KEY,
    queryFn: fetchStorage,
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * TanStack Query hook for storage capacity indicator.
 * Disabled for super_admin who belongs to no tenant (CLAUDE.md 5.1).
 */
export function useStorage(options?: { enabled?: boolean }): UseQueryResult<StorageView, Error> {
  return useQuery(storageQueryOptions(options?.enabled ?? true));
}

/**
 * Invalidate storage query after an upload settles (FE-S2-02, api-specs/04-configuration.md 4.5).
 */
// SCAFFOLD: the upload tray calls this once FE-S2-01 lands; wired end to end in FE-S2-07.
export async function invalidateStorage(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: STORAGE_QUERY_KEY });
}
