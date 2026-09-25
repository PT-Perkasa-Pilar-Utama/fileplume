import { describe, expect, test } from "bun:test";
import {
  buildTestApp,
  DOC_A_ID,
  type ErrorBody,
  errorOf,
  RAHASIA_B_DOC_ID,
  TENANT_A,
  TENANT_B,
  TOKENS,
  tenantRequest,
} from "../testing/test-app.ts";
import { MOCK_CATEGORY, MOCK_TENANT_B_CATEGORY_ID } from "./mocks.ts";

/**
 * Asserts that a cross-tenant read attempt returns 404 NOT_FOUND,
 * a sterile body without leaked metadata, and an access.denied audit event
 * recorded against the caller's tenant.
 *
 * References:
 * - api-specs/01-conventions.md 1.7.1, 1.13
 * - technical-specs/07-security.md 7.2, 7.3
 */
async function assertCrossTenantNotFound(
  res: Response,
  app: ReturnType<typeof buildTestApp>,
): Promise<void> {
  expect(res.status).toBe(404);
  // Typed test fixture: verify envelope contains only the sterile error object
  const body = (await res.json()) as ErrorBody;
  expect(Object.keys(body)).toEqual(["error"]);
  expect(Object.keys(body.error)).toEqual(["code", "message"]);
  expect(body.error).toEqual({
    code: "NOT_FOUND",
    message: "Data tidak ditemukan",
  });

  expect(app.activityRepository.events).toHaveLength(1);
  const event = app.activityRepository.events[0];
  expect(event?.tenantId).toBe(TENANT_A.id);
  expect(event?.action).toBe("access.denied");
  expect(event?.outcome).toBe("denied");
}

describe("cross-tenant document isolation (BE-S1-03, BE-S1-05)", () => {
  // AC-43.03: Isolasi data pada akses langsung (Negative Path)
  test("AC-43.03: direct document detail access with Tenant B id returns 404, sterile body, and writes audit event", async () => {
    // Seeded so the foreign id genuinely belongs to Tenant B in the
    // repository; an empty repo would be an unknown id, not cross-tenant.
    const app = buildTestApp(undefined, { seedDocuments: true });

    const res = await app.request(
      tenantRequest(`/documents/${RAHASIA_B_DOC_ID}`, {
        token: TOKENS.memberA,
      }),
    );

    await assertCrossTenantNotFound(res, app);
    const event = app.activityRepository.events[0];
    expect(event?.subjectType).toBe("document");
    expect(event?.subjectId).toBeNull();
    expect(event?.metadata).toEqual({ attemptedId: RAHASIA_B_DOC_ID });
  });

  // AC-43.04: Isolasi data pada endpoint unduhan (Negative Path)
  test("AC-43.04: direct document download with Tenant B id returns 404, no file, and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest(`/documents/${RAHASIA_B_DOC_ID}/download`, {
        method: "POST",
        token: TOKENS.memberA,
      }),
    );

    await assertCrossTenantNotFound(res, app);
    const event = app.activityRepository.events[0];
    expect(event?.subjectType).toBe("document");
    expect(event?.subjectId).toBeNull();
    expect(event?.metadata).toEqual({ attemptedId: RAHASIA_B_DOC_ID });
  });

  test("cross-tenant preview returns 404, sterile body, and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest(`/documents/${RAHASIA_B_DOC_ID}/preview`, {
        token: TOKENS.memberA,
      }),
    );

    await assertCrossTenantNotFound(res, app);
  });

  test("cross-tenant versions listing returns 404, sterile body, and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest(`/documents/${RAHASIA_B_DOC_ID}/versions`, {
        token: TOKENS.memberA,
      }),
    );

    await assertCrossTenantNotFound(res, app);
  });

  test("cross-tenant related documents returns 404, sterile body, and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest(`/documents/${RAHASIA_B_DOC_ID}/related`, {
        token: TOKENS.memberA,
      }),
    );

    await assertCrossTenantNotFound(res, app);
  });

  test("cross-tenant processing status returns 404, sterile body, and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest(`/documents/${RAHASIA_B_DOC_ID}/processing`, {
        token: TOKENS.memberA,
      }),
    );

    await assertCrossTenantNotFound(res, app);
  });

  test("legitimate document access within tenant succeeds without access.denied event", async () => {
    const app = buildTestApp(undefined, { seedDocuments: true });

    const res = await app.request(
      tenantRequest(`/documents/${DOC_A_ID}`, {
        token: TOKENS.memberA,
      }),
    );

    expect(res.status).toBe(200);
    // Typed test fixture: verify legitimate response envelope
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(DOC_A_ID);
    expect(app.activityRepository.events).toHaveLength(0);
  });

  test("step 3: principal of Tenant B on Tenant A host writes access.denied against Tenant B", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest("/documents", {
        subdomain: "contohbaru",
        token: TOKENS.memberB,
      }),
    );

    expect(res.status).toBe(404);
    expect(await errorOf(res)).toEqual({
      code: "NOT_FOUND",
      message: "Data tidak ditemukan",
    });
    expect(app.activityRepository.events).toHaveLength(1);
    const event = app.activityRepository.events[0];
    expect(event?.tenantId).toBe(TENANT_B.id);
    expect(event?.action).toBe("access.denied");
    expect(event?.outcome).toBe("denied");
  });

  test("cross-tenant admin routes: Tenant A member targeting Tenant B host returns 404 and writes audit event on Tenant A", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest(`/categories/${MOCK_CATEGORY.id}/download-permission`, {
        subdomain: "mitra-rahasia",
        method: "PUT",
        token: TOKENS.memberA,
        body: JSON.stringify({ downloadActive: true }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    await assertCrossTenantNotFound(res, app);
  });

  test("cross-tenant admin routes: Tenant A head_of_team setting download permission with Tenant B category id returns 404 and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest(`/categories/${MOCK_TENANT_B_CATEGORY_ID}/download-permission`, {
        method: "PUT",
        token: TOKENS.headOfTeamA,
        body: JSON.stringify({ downloadActive: true }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    await assertCrossTenantNotFound(res, app);
    const event = app.activityRepository.events[0];
    expect(event?.subjectType).toBe("category");
    expect(event?.subjectId).toBeNull();
    expect(event?.metadata).toEqual({ attemptedId: MOCK_TENANT_B_CATEGORY_ID });
  });

  test("cross-tenant admin routes: Tenant A head_of_team renaming Tenant B category id returns 404 and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest(`/categories/${MOCK_TENANT_B_CATEGORY_ID}`, {
        method: "PATCH",
        token: TOKENS.headOfTeamA,
        body: JSON.stringify({ name: "Nama Baru" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    await assertCrossTenantNotFound(res, app);
    const event = app.activityRepository.events[0];
    expect(event?.subjectType).toBe("category");
    expect(event?.subjectId).toBeNull();
    expect(event?.metadata).toEqual({ attemptedId: MOCK_TENANT_B_CATEGORY_ID });
  });

  test("cross-tenant admin routes: Tenant A admin targeting Tenant B host returns 404 and writes audit event on Tenant A", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest("/configuration", {
        subdomain: "mitra-rahasia",
        token: TOKENS.adminA,
      }),
    );

    await assertCrossTenantNotFound(res, app);
  });

  test("cross-tenant super admin route: Tenant A user targeting admin host returns 404 and writes audit event on Tenant A", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest("/tenants", {
        subdomain: "admin",
        token: TOKENS.memberA,
      }),
    );

    await assertCrossTenantNotFound(res, app);
  });
});
