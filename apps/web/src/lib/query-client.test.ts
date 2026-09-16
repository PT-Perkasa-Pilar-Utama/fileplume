import { beforeEach, describe, expect, test } from "bun:test";
import { useAuthStore } from "../features/auth/auth-store.ts";
import { ApiError } from "./api.ts";
import { createQueryClient, handleAuthError } from "./query-client.ts";

describe("query-client", () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  test("handleAuthError sets session expired in auth store on 401 ApiError", () => {
    const error = new ApiError(
      401,
      "UNAUTHENTICATED",
      "Sesi Anda telah berakhir. Silakan login kembali",
    );
    handleAuthError(error);

    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.principal).toBeNull();
    expect(state.sessionExpiredMessage).toBe("Sesi Anda telah berakhir. Silakan login kembali");
  });

  test("handleAuthError ignores non-401 errors", () => {
    const error = new ApiError(403, "FORBIDDEN", "Anda tidak memiliki akses ke halaman ini");
    handleAuthError(error);

    const state = useAuthStore.getState();
    expect(state.sessionExpiredMessage).toBeNull();
  });

  test("createQueryClient creates client with 401/403 retry rejection", () => {
    const client = createQueryClient();
    const defaultOptions = client.getDefaultOptions();
    const retry = defaultOptions.queries?.retry;

    expect(typeof retry).toBe("function");
    if (typeof retry === "function") {
      const err401 = new ApiError(401, "UNAUTHENTICATED", "Expired");
      const err403 = new ApiError(403, "FORBIDDEN", "Forbidden");
      const err500 = new ApiError(500, "INTERNAL_ERROR", "Server error");

      expect(retry(0, err401)).toBe(false);
      expect(retry(0, err403)).toBe(false);
      expect(retry(0, err500)).toBe(true);
      expect(retry(1, err500)).toBe(true);
      expect(retry(2, err500)).toBe(false);
    }
  });
});
