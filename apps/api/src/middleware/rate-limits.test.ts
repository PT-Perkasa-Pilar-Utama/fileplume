import { describe, expect, test } from "bun:test";
import type { Hono } from "hono";
import { buildTestApp, DOC_A_ID, TOKENS, tenantRequest } from "../testing/test-app.ts";
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
    const otherUploader = tenantRequest("/documents", {
      method: "POST",
      token: TOKENS.adminA,
      headers: { "content-type": "multipart/form-data; boundary=x" },
      body: "--x--",
    });
    expect((await app.request(otherUploader)).status).toBe(201);
  });

  test("upload: non-upload requests are not counted against the upload limit", async () => {
    const app = buildTestApp();
    const listDocuments = () => tenantRequest("/documents", { token: TOKENS.memberA });
    const nonUploadStatuses = await statuses(app, times(105, listDocuments));
    expect(nonUploadStatuses.every((status) => status === 200)).toBe(true);

    const upload = () =>
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        headers: { "content-type": "multipart/form-data; boundary=x" },
        body: "--x--",
      });
    const allowed = await statuses(app, times(100, upload));
    expect(allowed.every((status) => status === 201)).toBe(true);

    const overLimit = await app.request(upload());
    expect(overLimit.status).toBe(429);
    expect(overLimit.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await overLimit.json()).toEqual(RATE_LIMITED);
  });

  test("upload: document uploads and version uploads share the user limit", async () => {
    const app = buildTestApp();
    const uploadDoc = () =>
      tenantRequest("/documents", {
        method: "POST",
        token: TOKENS.memberA,
        headers: { "content-type": "multipart/form-data; boundary=x" },
        body: "--x--",
      });
    const uploadVersion = () =>
      tenantRequest(`/documents/${DOC_A_ID}/versions`, {
        method: "POST",
        token: TOKENS.memberA,
        headers: { "content-type": "multipart/form-data; boundary=x" },
        body: "--x--",
      });

    const allowedDocs = await statuses(app, times(50, uploadDoc));
    expect(allowedDocs.every((status) => status === 201)).toBe(true);

    const allowedVersions = await statuses(app, times(50, uploadVersion));
    expect(allowedVersions.every((status) => status === 201)).toBe(true);

    const overLimit = await app.request(uploadVersion());
    expect(overLimit.status).toBe(429);
    expect(overLimit.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await overLimit.json()).toEqual(RATE_LIMITED);

    const otherUploader = tenantRequest("/documents", {
      method: "POST",
      token: TOKENS.adminA,
      headers: { "content-type": "multipart/form-data; boundary=x" },
      body: "--x--",
    });
    expect((await app.request(otherUploader)).status).toBe(201);
  });

  test("search: unauthenticated queries are not counted against the search limit", async () => {
    const app = buildTestApp();
    const unauthenticatedSearch = () => tenantRequest("/search/titles?q=kontrak");
    const unauthenticatedStatuses = await statuses(app, times(65, unauthenticatedSearch));
    expect(unauthenticatedStatuses.every((status) => status === 401)).toBe(true);

    const authenticatedSearch = () =>
      tenantRequest("/search/titles?q=kontrak", { token: TOKENS.memberA });
    const allowed = await statuses(app, times(60, authenticatedSearch));
    expect(allowed.every((status) => status === 200)).toBe(true);

    const overLimit = await app.request(authenticatedSearch());
    expect(overLimit.status).toBe(429);
    expect(overLimit.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await overLimit.json()).toEqual(RATE_LIMITED);
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
