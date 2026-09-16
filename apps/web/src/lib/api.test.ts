import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { dataOf } from "@archiva/shared";
import { z } from "zod";
import { ApiError, apiFetch } from "./api.ts";

describe("api helper", () => {
  const fetchSpy = spyOn(globalThis, "fetch");

  afterEach(() => {
    fetchSpy.mockReset();
  });

  test("ApiError retains status, code and message", () => {
    const error = new ApiError(401, "UNAUTHENTICATED", "Sesi Anda telah berakhir");
    expect(error.name).toBe("ApiError");
    expect(error.status).toBe(401);
    expect(error.code).toBe("UNAUTHENTICATED");
    expect(error.message).toBe("Sesi Anda telah berakhir");
  });

  test("apiFetch parses valid response matching schema", async () => {
    const payload = { data: { id: "test-id", value: 42 } };
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const schema = dataOf(z.object({ id: z.string(), value: z.number() }));
    const result = await apiFetch("/test", schema);

    expect(result.data.id).toBe("test-id");
    expect(result.data.value).toBe(42);
  });

  test("apiFetch handles 204 No Content returning null", async () => {
    fetchSpy.mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );

    const schema = z.null().optional();
    const result = await apiFetch("/empty", schema);
    expect(result).toBeNull();
  });

  test("apiFetch throws ApiError on standard error envelope", async () => {
    const errorEnvelope = {
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Email atau password salah",
      },
    };
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(errorEnvelope), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const schema = z.object({ ok: z.boolean() });
    try {
      await apiFetch("/login", schema);
      expect().fail("should have thrown ApiError");
    } catch (err) {
      if (err instanceof ApiError) {
        expect(err.status).toBe(401);
        expect(err.code).toBe("INVALID_CREDENTIALS");
        expect(err.message).toBe("Email atau password salah");
      } else {
        expect().fail("expected ApiError");
      }
    }
  });

  test("apiFetch maps non-envelope error body to INTERNAL_ERROR", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ unformatted: "bad gateway" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const schema = z.object({ ok: z.boolean() });
    try {
      await apiFetch("/broken", schema);
      expect().fail("should have thrown ApiError");
    } catch (err) {
      if (err instanceof ApiError) {
        expect(err.status).toBe(502);
        expect(err.code).toBe("INTERNAL_ERROR");
      } else {
        expect().fail("expected ApiError");
      }
    }
  });
});
