import { describe, expect, test } from "bun:test";
import { buildTestApp, errorOf, TOKENS, tenantRequest } from "../testing/test-app.ts";

const DOC_ID = "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01";

const withJson = (path: string, token: string, method: string, body: unknown) =>
  tenantRequest(path, {
    method,
    token,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("request validation, api-specs/01-conventions.md 1.6 and 1.12", () => {
  test("the role floor refuses before the body is validated", async () => {
    const res = await buildTestApp().request(
      withJson("/categories", TOKENS.memberA, "POST", { name: "" }),
    );
    expect(res.status).toBe(403);
    expect((await errorOf(res)).code).toBe("FORBIDDEN");
  });

  test("a malformed body answers VALIDATION_ERROR with one detail per field", async () => {
    const res = await buildTestApp().request(
      withJson("/categories", TOKENS.adminA, "POST", { name: "" }),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toEqual({
      code: "VALIDATION_ERROR",
      message: "Data yang dikirim tidak valid",
      details: [{ field: "name", issue: "too_small" }],
    });
  });

  test("a sort field outside the enumeration is refused", async () => {
    const res = await buildTestApp().request(
      tenantRequest("/documents?sort=uploaderEmail", { token: TOKENS.memberA }),
    );
    expect(res.status).toBe(422);
    expect((await errorOf(res)).details).toEqual([{ field: "sort", issue: "invalid_value" }]);
  });

  test("a repeated query parameter is accepted", async () => {
    const res = await buildTestApp().request(
      tenantRequest("/documents?tags=strategy&tags=legal", { token: TOKENS.memberA }),
    );
    expect(res.status).toBe(200);
  });

  test("a malformed path id is refused before the handler", async () => {
    const res = await buildTestApp().request(
      tenantRequest("/documents/not-a-uuid", { token: TOKENS.memberA }),
    );
    expect(res.status).toBe(422);
    expect((await errorOf(res)).details).toEqual([{ field: "id", issue: "invalid_format" }]);
  });

  test("an unknown configuration key is VALIDATION_ERROR, not 404", async () => {
    // api-specs/04-configuration.md 4.3 step 1: the key space is a type, not a collection.
    const res = await buildTestApp().request(
      withJson("/configuration/theme", TOKENS.adminA, "PATCH", { value: 1 }),
    );
    expect(res.status).toBe(422);
    expect((await errorOf(res)).code).toBe("VALIDATION_ERROR");
  });

  test("a fourth tag passes the schema, so the service can answer TOO_MANY_TAGS", async () => {
    // AC-05.05's message is the service's; a schema cap would pre-empt it with VALIDATION_ERROR.
    const res = await buildTestApp().request(
      withJson(`/documents/${DOC_ID}/tags`, TOKENS.memberA, "PUT", {
        tags: ["strategy", "legal", "finance", "hr"],
      }),
    );
    expect(res.status).not.toBe(422);
  });
});
