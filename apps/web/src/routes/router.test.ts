import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { PrincipalView } from "@archiva/shared";
import { isRedirect } from "@tanstack/react-router";
import * as authApi from "../features/auth/api.ts";
import { useAuthStore } from "../features/auth/auth-store.ts";
import { ApiError } from "../lib/api.ts";
import { checkAuthBeforeLoad } from "./router.tsx";

const MOCK_PRINCIPAL: PrincipalView = {
  user: {
    id: "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10",
    name: "Budi Santoso",
    email: "budi@contohbaru.co.id",
    role: "member",
    avatarUrl: null,
  },
  tenant: {
    id: "1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b",
    name: "PT Contoh Baru",
    subdomain: "contohbaru",
  },
  menus: ["dashboard", "document"],
  expiresAt: "2026-10-10T03:14:07.000Z",
};

describe("checkAuthBeforeLoad route guard", () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  test("returns immediately if principal is already authenticated in store", async () => {
    useAuthStore.getState().setPrincipal(MOCK_PRINCIPAL);
    const fetchSpy = spyOn(authApi, "fetchCurrentPrincipal");

    await checkAuthBeforeLoad("/documents");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test("sets principal in store if fetchCurrentPrincipal succeeds", async () => {
    const fetchSpy = spyOn(authApi, "fetchCurrentPrincipal").mockResolvedValue(MOCK_PRINCIPAL);

    await checkAuthBeforeLoad("/documents");
    expect(useAuthStore.getState().principal).toEqual(MOCK_PRINCIPAL);
    expect(useAuthStore.getState().status).toBe("authenticated");
    fetchSpy.mockRestore();
  });

  test("redirects to login with expired=true and sets sessionExpired on 401 ApiError", async () => {
    const fetchSpy = spyOn(authApi, "fetchCurrentPrincipal").mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Sesi Anda telah berakhir. Silakan login kembali"),
    );

    try {
      await checkAuthBeforeLoad("/documents?page=2");
      expect().fail("should have thrown redirect");
    } catch (err: unknown) {
      expect(isRedirect(err)).toBe(true);
      if (isRedirect(err)) {
        expect(err.options.to).toBe("/login");
        expect(typeof err.options.search).toBe("object");
        expect(err.options.search).toMatchObject({
          redirect: "/documents?page=2",
          expired: true,
        });
      }
    }

    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.principal).toBeNull();
    expect(state.sessionExpiredMessage).toBe("Sesi Anda telah berakhir. Silakan login kembali");

    fetchSpy.mockRestore();
  });

  test("redirects to login without expired alert on 404 ApiError", async () => {
    const fetchSpy = spyOn(authApi, "fetchCurrentPrincipal").mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Tenant tidak ditemukan"),
    );

    try {
      await checkAuthBeforeLoad("/documents");
      expect().fail("should have thrown redirect");
    } catch (err: unknown) {
      expect(isRedirect(err)).toBe(true);
      if (isRedirect(err)) {
        expect(err.options.to).toBe("/login");
        expect(typeof err.options.search).toBe("object");
        expect(err.options.search).toMatchObject({
          redirect: "/documents",
          expired: false,
        });
      }
    }

    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.principal).toBeNull();
    expect(state.sessionExpiredMessage).toBeNull();

    fetchSpy.mockRestore();
  });

  test("re-throws without redirecting to login on 500 ApiError", async () => {
    const fetchSpy = spyOn(authApi, "fetchCurrentPrincipal").mockRejectedValue(
      new ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan pada sistem"),
    );

    try {
      await checkAuthBeforeLoad("/documents");
      expect().fail("should have re-thrown 500 error");
    } catch (err: unknown) {
      expect(isRedirect(err)).toBe(false);
      expect(err instanceof ApiError).toBe(true);
      if (err instanceof ApiError) {
        expect(err.status).toBe(500);
      }
    }

    const state = useAuthStore.getState();
    expect(state.sessionExpiredMessage).toBeNull();

    fetchSpy.mockRestore();
  });
});
