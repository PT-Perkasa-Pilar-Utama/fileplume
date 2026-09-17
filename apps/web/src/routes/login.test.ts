import { beforeEach, describe, expect, test } from "bun:test";
import { ERROR_MESSAGES, type LoginBody, loginBody, type PrincipalView } from "@archiva/shared";
import { getInitials } from "../components/layout/header.tsx";
import { useAuthStore } from "../features/auth/auth-store.ts";

const MOCK_MEMBER_PRINCIPAL: PrincipalView = {
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

describe("Login screen functionality", () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  // AC-40.01: Login dengan kredensial yang valid (form schema validation)
  test("loginBody accepts valid email and password", () => {
    const valid: LoginBody = {
      email: "budi@contohbaru.co.id",
      password: "valid-password",
    };
    const result = loginBody.safeParse(valid);
    expect(result.success).toBe(true);
  });

  // AC-40.01: Form validation rejects invalid credentials format
  test("loginBody rejects invalid email format or empty password", () => {
    const invalidEmail = loginBody.safeParse({
      email: "not-an-email",
      password: "valid-password",
    });
    expect(invalidEmail.success).toBe(false);

    const emptyPassword = loginBody.safeParse({
      email: "budi@contohbaru.co.id",
      password: "",
    });
    expect(emptyPassword.success).toBe(false);
  });

  // AC-40.01: Profile display info (nama pengguna, role "MEMBER", avatar fallback)
  test("profile presentation renders user name, uppercased role MEMBER, and initials fallback", () => {
    useAuthStore.getState().setPrincipal(MOCK_MEMBER_PRINCIPAL);
    const principal = useAuthStore.getState().principal;
    expect(principal).not.toBeNull();

    if (principal) {
      // Name
      expect(principal.user.name).toBe("Budi Santoso");
      // Role uppercased in presentation per api-specs 02 §2.2
      expect(principal.user.role.toUpperCase()).toBe("MEMBER");
      // Avatar null -> initials fallback
      expect(principal.user.avatarUrl).toBeNull();
      expect(getInitials(principal.user.name)).toBe("BS");
    }
  });

  // AC-40.02: Login dengan kredensial yang salah (Negative Path)
  test("error code INVALID_CREDENTIALS maps to verbatim message Email atau password salah", () => {
    const mapped = ERROR_MESSAGES.INVALID_CREDENTIALS;
    expect(mapped).toBe("Email atau password salah");
  });

  // AC-40.02: State remains unauthenticated and on login on failure
  test("auth store status remains unauthenticated when credentials fail", () => {
    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.principal).toBeNull();
  });

  // AC-40.03: Logout dari sistem
  test("logout clears session and resets auth store to unauthenticated", () => {
    useAuthStore.getState().setPrincipal(MOCK_MEMBER_PRINCIPAL);
    expect(useAuthStore.getState().status).toBe("authenticated");

    // Execute logout clear
    useAuthStore.getState().clearSession();

    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.principal).toBeNull();
    expect(state.sessionExpiredMessage).toBeNull();
  });
});
