import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { PrincipalView, Session } from "@archiva/shared";
import { fetchCurrentPrincipal, loginRequest, logoutRequest } from "./api.ts";

const MOCK_SESSION: Session = {
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
  expiresAt: "2026-10-10T03:14:07.000Z",
};

const MOCK_PRINCIPAL: PrincipalView = {
  ...MOCK_SESSION,
  menus: ["dashboard", "document"],
};

describe("auth api", () => {
  const fetchSpy = spyOn(globalThis, "fetch");

  afterEach(() => {
    fetchSpy.mockReset();
  });

  // AC-40.01: Login dengan kredensial yang valid
  test("loginRequest posts credentials and resolves full principal via /auth/me", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: MOCK_SESSION }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: MOCK_PRINCIPAL }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await loginRequest({
      email: "budi@contohbaru.co.id",
      password: "secret",
    });

    expect(result).toEqual(MOCK_PRINCIPAL);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const [firstUrl, firstInit] = fetchSpy.mock.calls[0] ?? [];
    expect(firstUrl?.toString()).toContain("/api/v1/auth/login");
    expect(firstInit?.method).toBe("POST");
    expect(firstInit?.body).toBe(
      JSON.stringify({ email: "budi@contohbaru.co.id", password: "secret" }),
    );

    const [secondUrl] = fetchSpy.mock.calls[1] ?? [];
    expect(secondUrl?.toString()).toContain("/api/v1/auth/me");
  });

  // AC-40.03: Logout dari sistem
  test("logoutRequest posts to /auth/logout", async () => {
    fetchSpy.mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );

    await logoutRequest();

    expect(fetchSpy).toHaveBeenCalled();
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url?.toString()).toContain("/api/v1/auth/logout");
    expect(init?.method).toBe("POST");
  });

  test("fetchCurrentPrincipal queries /auth/me", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: MOCK_PRINCIPAL }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchCurrentPrincipal();
    expect(result).toEqual(MOCK_PRINCIPAL);
  });
});
