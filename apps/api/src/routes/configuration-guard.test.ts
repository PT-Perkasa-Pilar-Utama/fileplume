import { describe, expect, test } from "bun:test";
import { buildTestApp, errorOf, TOKENS, tenantRequest } from "../testing/test-app.ts";

describe("configuration guards", () => {
  // api-specs/04-configuration.md 4.3 step 2: storage_quota_gb is refused
  // before any role check, so the refusal does not depend on the caller's rank.
  test("storage_quota_gb is refused with 403 NOT_EDITABLE_BY_TENANT for admin_tenant", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration/storage_quota_gb", {
        method: "PATCH",
        token: TOKENS.adminA,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: 100 }),
      }),
    );

    expect(res.status).toBe(403);
    expect(await errorOf(res)).toEqual({
      code: "NOT_EDITABLE_BY_TENANT",
      message: "Parameter ini hanya dapat diubah oleh Super Admin",
    });
  });

  test("storage_quota_gb is refused before role check with NOT_EDITABLE_BY_TENANT even for member", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration/storage_quota_gb", {
        method: "PATCH",
        token: TOKENS.memberA,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: 100 }),
      }),
    );

    expect(res.status).toBe(403);
    expect(await errorOf(res)).toEqual({
      code: "NOT_EDITABLE_BY_TENANT",
      message: "Parameter ini hanya dapat diubah oleh Super Admin",
    });
  });

  // api-specs/04-configuration.md 4.4 step 1: same refusal on DELETE.
  test("storage_quota_gb is refused with NOT_EDITABLE_BY_TENANT on DELETE", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration/storage_quota_gb", {
        method: "DELETE",
        token: TOKENS.memberA,
      }),
    );

    expect(res.status).toBe(403);
    expect(await errorOf(res)).toEqual({
      code: "NOT_EDITABLE_BY_TENANT",
      message: "Parameter ini hanya dapat diubah oleh Super Admin",
    });
  });

  test("unknown key returns 422 VALIDATION_ERROR", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration/unknown_parameter", {
        method: "PATCH",
        token: TOKENS.adminA,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: 50 }),
      }),
    );

    expect(res.status).toBe(422);
    expect((await errorOf(res))?.code).toBe("VALIDATION_ERROR");
  });

  // Cross-tenant writes must not confirm the tenant is real: 404, not 403.
  test("cross-tenant PATCH returns 404 NOT_FOUND", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration/max_file_size_mb", {
        subdomain: "mitra-rahasia",
        method: "PATCH",
        token: TOKENS.adminA,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: 50 }),
      }),
    );

    expect(res.status).toBe(404);
    expect((await errorOf(res))?.code).toBe("NOT_FOUND");
  });

  test("cross-tenant DELETE returns 404 NOT_FOUND", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration/max_file_size_mb", {
        subdomain: "mitra-rahasia",
        method: "DELETE",
        token: TOKENS.adminA,
      }),
    );

    expect(res.status).toBe(404);
    expect((await errorOf(res))?.code).toBe("NOT_FOUND");
  });
});
