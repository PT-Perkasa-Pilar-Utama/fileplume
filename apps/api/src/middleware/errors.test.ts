import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { z } from "zod";
import { buildTestApp } from "../testing/test-app.ts";
import { errorHandler, validationFailed } from "./errors.ts";

describe("error envelope", () => {
  test("an unknown path answers in the envelope", async () => {
    const res = await buildTestApp().request("/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Data tidak ditemukan" },
    });
  });

  test("a framework refusal is enveloped and keeps its challenge header", async () => {
    const res = await buildTestApp().request("/health/ready");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
    expect(await res.json()).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Sesi Anda telah berakhir. Silakan login kembali",
      },
    });
  });

  test("an unhandled fault is a 500 that carries no internal detail", async () => {
    const app = new Hono().get("/boom", () => {
      throw new Error("driver: connection refused at 10.0.0.3");
    });
    app.onError(errorHandler);
    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan pada sistem" },
    });
  });

  test("a Zod rejection lists every field in details", async () => {
    const schema = z.object({ files: z.array(z.object({ name: z.string() })), title: z.string() });
    const app = new Hono().post("/", async (c) => {
      const parsed = schema.safeParse(await c.req.json());
      return parsed.success ? c.body(null, 204) : validationFailed(c, parsed.error);
    });
    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ files: [{ name: 1 }] }),
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Data yang dikirim tidak valid",
        details: [
          { field: "files[0].name", issue: "invalid_type" },
          { field: "title", issue: "invalid_type" },
        ],
      },
    });
  });
});
