import { ERROR_MESSAGES, type PrincipalView } from "@archiva/shared";
import { create } from "zustand";

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  principal: PrincipalView | null;
  status: AuthStatus;
  sessionExpiredMessage: string | null;
  setPrincipal: (principal: PrincipalView) => void;
  clearSession: () => void;
  setSessionExpired: (message?: string) => void;
  setStatus: (status: AuthStatus) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  principal: null,
  status: "idle",
  sessionExpiredMessage: null,
  setPrincipal: (principal: PrincipalView) =>
    set({
      principal,
      status: "authenticated",
      sessionExpiredMessage: null,
    }),
  clearSession: () =>
    set({
      principal: null,
      status: "unauthenticated",
      sessionExpiredMessage: null,
    }),
  setSessionExpired: (message?: string) =>
    set({
      principal: null,
      status: "unauthenticated",
      sessionExpiredMessage: message ?? ERROR_MESSAGES.SESSION_EXPIRED,
    }),
  setStatus: (status: AuthStatus) => set({ status }),
}));
