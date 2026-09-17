import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { LoginBody, PrincipalView, Session } from "@archiva/shared";
import { ERROR_MESSAGES } from "@archiva/shared";
import { ApiError } from "../../lib/api.ts";
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

  // AC-40.02: Login dengan kredensial yang salah (Negative Path)
  test("loginRequest throws 401 INVALID_CREDENTIALS on wrong password or unknown email", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "INVALID_CREDENTIALS",
            message: ERROR_MESSAGES.INVALID_CREDENTIALS,
          },
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    try {
      await loginRequest({
        email: "budi@contohbaru.co.id",
        password: "wrong-password",
      });
      expect().fail("should have thrown ApiError");
    } catch (err: unknown) {
      expect(err instanceof ApiError).toBe(true);
      if (err instanceof ApiError) {
        expect(err.status).toBe(401);
        expect(err.code).toBe("INVALID_CREDENTIALS");
        expect(err.message).toBe("Email atau password salah");
      }
    }
  });

  // Typed error: 422 VALIDATION_ERROR
  test("loginRequest throws 422 VALIDATION_ERROR on malformed request", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: ERROR_MESSAGES.VALIDATION_ERROR,
          },
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    try {
      // Typed test fixture: intentional invalid email format to verify 422 mapping
      const invalidBody: LoginBody = {
        email: "not-an-email" as string,
        password: "secret",
      };
      await loginRequest(invalidBody);
      expect().fail("should have thrown ApiError");
    } catch (err: unknown) {
      expect(err instanceof ApiError).toBe(true);
      if (err instanceof ApiError) {
        expect(err.status).toBe(422);
        expect(err.code).toBe("VALIDATION_ERROR");
        expect(err.message).toBe("Data yang dikirim tidak valid");
      }
    }
  });

  // Typed error: 429 RATE_LIMITED
  test("loginRequest throws 429 RATE_LIMITED on rate limit exhaustion", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "RATE_LIMITED",
            message: ERROR_MESSAGES.RATE_LIMITED,
          },
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    try {
      await loginRequest({
        email: "budi@contohbaru.co.id",
        password: "secret",
      });
      expect().fail("should have thrown ApiError");
    } catch (err: unknown) {
      expect(err instanceof ApiError).toBe(true);
      if (err instanceof ApiError) {
        expect(err.status).toBe(429);
        expect(err.code).toBe("RATE_LIMITED");
        expect(err.message).toBe("Terlalu banyak permintaan. Coba lagi nanti");
      }
    }
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

  // AC-40.03: Logout idempotency
  test("logoutRequest succeeds when already logged out (204 No Content)", async () => {
    fetchSpy.mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );

    await expect(logoutRequest()).resolves.toBeUndefined();
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
