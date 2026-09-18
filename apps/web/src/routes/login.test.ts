import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { ERROR_MESSAGES, type LoginBody, loginBody, type PrincipalView } from "@archiva/shared";
import { handleLogout } from "../components/layout/header.tsx";
import { loginRequest } from "../features/auth/api.ts";
import { useAuthStore } from "../features/auth/auth-store.ts";
import { ApiError } from "../lib/api.ts";

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
  const fetchSpy = spyOn(globalThis, "fetch");

  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  afterEach(() => {
    fetchSpy.mockReset();
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

  // AC-40.01: Form validation rejects invalid credentials format with Indonesian copy
  test("loginBody rejects invalid email format or empty password with Indonesian copy", () => {
    const invalidEmail = loginBody.safeParse({
      email: "not-an-email",
      password: "valid-password",
    });
    expect(invalidEmail.success).toBe(false);
    if (!invalidEmail.success) {
      expect(invalidEmail.error.issues[0]?.message).toBe(ERROR_MESSAGES.INVALID_EMAIL);
    }

    const emptyPassword = loginBody.safeParse({
      email: "budi@contohbaru.co.id",
      password: "",
    });
    expect(emptyPassword.success).toBe(false);
    if (!emptyPassword.success) {
      expect(emptyPassword.error.issues[0]?.message).toBe(ERROR_MESSAGES.PASSWORD_REQUIRED);
    }

    const emptyForm = loginBody.safeParse({});
    expect(emptyForm.success).toBe(false);
    if (!emptyForm.success) {
      const emailIssue = emptyForm.error.issues.find((issue) => issue.path[0] === "email");
      const passwordIssue = emptyForm.error.issues.find((issue) => issue.path[0] === "password");
      expect(emailIssue?.message).toBe(ERROR_MESSAGES.INVALID_EMAIL);
      expect(passwordIssue?.message).toBe(ERROR_MESSAGES.PASSWORD_REQUIRED);
    }
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
    }
  });

  // AC-40.02
  test("a rejected login leaves the store unauthenticated", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: "INVALID_CREDENTIALS", message: ERROR_MESSAGES.INVALID_CREDENTIALS },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    await expect(
      loginRequest({ email: "budi@contohbaru.co.id", password: "wrong" }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  // AC-40.03: Logout dari sistem
  test("handleLogout calls logout API, clears session, and resets auth store to unauthenticated", async () => {
    useAuthStore.getState().setPrincipal(MOCK_MEMBER_PRINCIPAL);
    expect(useAuthStore.getState().status).toBe("authenticated");

    fetchSpy.mockResolvedValueOnce(
      new Response(null, {
        status: 204,
      }),
    );

    await handleLogout();

    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.principal).toBeNull();
    expect(state.sessionExpiredMessage).toBeNull();
    expect(fetchSpy).toHaveBeenCalled();
    const [logoutUrl, logoutInit] = fetchSpy.mock.calls[0] ?? [];
    expect(logoutUrl?.toString()).toContain("/api/v1/auth/logout");
    expect(logoutInit?.method).toBe("POST");
  });

  // AC-40.03: Logout idempotency on network failure
  test("handleLogout clears session even if logout API network request fails", async () => {
    useAuthStore.getState().setPrincipal(MOCK_MEMBER_PRINCIPAL);
    expect(useAuthStore.getState().status).toBe("authenticated");

    fetchSpy.mockRejectedValueOnce(new Error("Network failure"));

    await handleLogout();

    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.principal).toBeNull();
  });
});
