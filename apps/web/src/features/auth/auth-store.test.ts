import { beforeEach, describe, expect, test } from "bun:test";
import type { PrincipalView } from "@archiva/shared";
import { ERROR_MESSAGES } from "@archiva/shared";
import { useAuthStore } from "./auth-store.ts";

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

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      principal: null,
      status: "idle",
      sessionExpiredMessage: null,
    });
  });

  test("initial state is idle and unauthenticated", () => {
    const state = useAuthStore.getState();
    expect(state.principal).toBeNull();
    expect(state.status).toBe("idle");
    expect(state.sessionExpiredMessage).toBeNull();
  });

  test("setPrincipal sets authenticated state and principal view", () => {
    useAuthStore.getState().setPrincipal(MOCK_PRINCIPAL);
    const state = useAuthStore.getState();
    expect(state.principal).toEqual(MOCK_PRINCIPAL);
    expect(state.status).toBe("authenticated");
    expect(state.sessionExpiredMessage).toBeNull();
  });

  test("clearSession resets principal and sets status to unauthenticated", () => {
    useAuthStore.getState().setPrincipal(MOCK_PRINCIPAL);
    useAuthStore.getState().clearSession();
    const state = useAuthStore.getState();
    expect(state.principal).toBeNull();
    expect(state.status).toBe("unauthenticated");
  });

  test("setSessionExpired sets session expired message with Indonesian copy", () => {
    useAuthStore.getState().setPrincipal(MOCK_PRINCIPAL);
    useAuthStore.getState().setSessionExpired();
    const state = useAuthStore.getState();
    expect(state.principal).toBeNull();
    expect(state.status).toBe("unauthenticated");
    expect(state.sessionExpiredMessage).toBe(ERROR_MESSAGES.SESSION_EXPIRED);
  });
});
