import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../features/auth/auth-store.ts";
import { ApiError } from "./api.ts";

export function handleAuthError(error: unknown): void {
  if (error instanceof ApiError && error.status === 401) {
    useAuthStore.getState().setSessionExpired(error.message);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?redirect=${redirect}&expired=true`;
    }
  }
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        handleAuthError(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        handleAuthError(error);
      },
    }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            return false;
          }
          return failureCount < 2;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
      },
    },
  });
}

export const queryClient = createQueryClient();
