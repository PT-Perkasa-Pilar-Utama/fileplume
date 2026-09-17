import { describe, expect, test } from "bun:test";
import type { Hono } from "hono";
import { buildTestApp, TOKENS, tenantRequest } from "../testing/test-app.ts";
import type { AppEnv } from "./context.ts";

const RATE_LIMITED = {
  error: { code: "RATE_LIMITED", message: "Terlalu banyak permintaan. Coba lagi nanti" },
};

const login = (email: string, ip: string) =>
  tenantRequest("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, password: "salah" }),
  });

async function statuses(app: Hono<AppEnv>, requests: (() => Request)[]): Promise<number[]> {
  const result: number[] = [];
  for (const build of requests) result.push((await app.request(build())).status);
  return result;
}

const times = (n: number, build: (i: number) => Request) =>
  Array.from({ length: n }, (_, i) => () => build(i));

describe("rate limits, api-specs/01-conventions.md 1.10", () => {
  test("login: the sixth attempt from one IP in a minute is refused", async () => {
    const app = buildTestApp();
    const allowed = await statuses(
      app,
      times(5, (i) => login(`u${i}@contoh.id`, "203.0.113.7")),
    );
    expect(allowed).toEqual([401, 401, 401, 401, 401]);

    const res = await app.request(login("u9@contoh.id", "203.0.113.7"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await res.json()).toEqual(RATE_LIMITED);
  });

  test("login: the sixth attempt at one email is refused across IPs", async () => {
    const app = buildTestApp();
    await statuses(
      app,
      times(5, (i) => login("Budi@contoh.id", `203.0.113.${i + 10}`)),
    );
    const res = await app.request(login("budi@contoh.id", "203.0.113.99"));
    expect(res.status).toBe(429);
  });

  test("search: the sixty-first query in a minute from one session is refused", async () => {
    const app = buildTestApp();
    const search = () => tenantRequest("/search/titles?q=kontrak", { token: TOKENS.memberA });
    const allowed = await statuses(app, times(60, search));
    expect(allowed.every((status) => status === 200)).toBe(true);

    expect((await app.request(search())).status).toBe(429);
    const otherSession = tenantRequest("/search/titles?q=kontrak", { token: TOKENS.adminA });
    expect((await app.request(otherSession)).status).toBe(200);
  });

  test("upload: the hundred-and-first upload in an hour by one user is refused", async () => {
    const app = buildTestApp();
    const upload = () =>
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        headers: { "content-type": "multipart/form-data; boundary=x" },
        body: "--x--",
      });
    const allowed = await statuses(app, times(100, upload));
    expect(allowed.every((status) => status === 201)).toBe(true);
    expect((await app.request(upload())).status).toBe(429);
  });

  test("reset-state: a second call within a minute is refused", async () => {
    const app = buildTestApp();
    const reset = () =>
      new Request("http://localhost/admin/reset-state", {
        method: "POST",
        headers: { authorization: "Bearer dev-reset-token", "content-type": "application/json" },
        body: JSON.stringify({ seed: "dev", confirm: "reset-dev" }),
      });
    expect(await statuses(app, [reset, reset])).toEqual([202, 429]);
  });
});
