import { describe, expect, test } from "bun:test";
import { buildTestApp, errorOf, TOKENS, tenantRequest } from "../testing/test-app.ts";

function request(path: string, method: string, token: string, body?: object): Request {
  return tenantRequest(path, {
    method,
    token,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("category taxonomy", () => {
  // AC-45.01
  test("head creates inactive category visible to a member", async () => {
    const app = buildTestApp();
    const response = await app.request(
      request("/categories", "POST", TOKENS.headOfTeamA, {
        name: "Reporting",
        downloadActive: true,
      }),
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created.data.name).toBe("Reporting");
    expect(created.data.downloadActive).toBe(false);
    expect(response.headers.get("location")).toBe(`/api/v1/categories/${created.data.id}`);
    const list = await app.request(request("/categories", "GET", TOKENS.memberA));
    expect((await list.json()).data).toHaveLength(1);
  });

  // AC-45.02
  test("duplicate name is rejected regardless of case", async () => {
    const app = buildTestApp();
    await app.request(request("/categories", "POST", TOKENS.headOfTeamA, { name: "Reporting" }));
    const duplicate = await app.request(
      request("/categories", "POST", TOKENS.headOfTeamA, { name: "reporting" }),
    );
    expect(duplicate.status).toBe(409);
    expect((await errorOf(duplicate)).message).toBe("Kategori dengan nama tersebut sudah ada");
    expect(
      app.activityRepository.events.some(
        (event) => event.action === "access.denied" && event.metadata?.reason === "DuplicateName",
      ),
    ).toBe(true);
    const list = await app.request(request("/categories", "GET", TOKENS.memberA));
    expect((await list.json()).data).toHaveLength(1);
  });

  test("member cannot create categories", async () => {
    const app = buildTestApp();
    const res = await app.request(
      request("/categories", "POST", TOKENS.memberA, { name: "Reporting" }),
    );
    expect(res.status).toBe(403);
    expect(app.activityRepository.events.some((event) => event.action === "access.denied")).toBe(
      true,
    );
  });

  test("a category from another tenant cannot be renamed", async () => {
    const app = buildTestApp();
    const created = await app.request(
      request("/categories", "POST", TOKENS.headOfTeamA, { name: "Reporting" }),
    );
    const body = await created.json();
    const res = await app.request(
      tenantRequest(`/categories/${body.data.id}`, {
        method: "PATCH",
        subdomain: "mitra-rahasia",
        token: TOKENS.headOfTeamB,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Other" }),
      }),
    );
    expect(res.status).toBe(404);
  });
});
