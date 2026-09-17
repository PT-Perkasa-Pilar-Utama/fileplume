import { describe, expect, test } from "bun:test";
import {
  buildTestApp,
  DOC_A_ID,
  errorOf,
  RAHASIA_B_DOC_ID,
  TENANT_A,
  TENANT_B,
  TOKENS,
  tenantRequest,
} from "../testing/test-app.ts";

describe("cross-tenant document isolation (BE-S1-03)", () => {
  // AC-43.03: Isolasi data pada akses langsung (Negative Path)
  test("AC-43.03: direct document detail access with Tenant B id returns 404 and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest(`/documents/${RAHASIA_B_DOC_ID}`, {
        token: TOKENS.memberA,
      }),
    );

    // api-specs/01-conventions.md 1.7.1, 1.13: 404 NOT_FOUND, never 403,
    // so existence does not leak across tenants.
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toEqual({
      code: "NOT_FOUND",
      message: "Data tidak ditemukan",
    });

    // Audit event written against caller's own tenant (Tenant A), not victim tenant (Tenant B).
    expect(app.activityRepository.events).toHaveLength(1);
    const event = app.activityRepository.events[0];
    expect(event).toBeDefined();
    expect(event?.tenantId).toBe(TENANT_A.id);
    expect(event?.action).toBe("access.denied");
    expect(event?.outcome).toBe("denied");
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

    expect(res.status).toBe(404);
    expect(await errorOf(res)).toEqual({
      code: "NOT_FOUND",
      message: "Data tidak ditemukan",
    });

    // Audit event written against caller's own tenant (Tenant A).
    expect(app.activityRepository.events).toHaveLength(1);
    const event = app.activityRepository.events[0];
    expect(event).toBeDefined();
    expect(event?.tenantId).toBe(TENANT_A.id);
    expect(event?.action).toBe("access.denied");
    expect(event?.outcome).toBe("denied");
    expect(event?.subjectType).toBe("document");
    expect(event?.subjectId).toBeNull();
    expect(event?.metadata).toEqual({ attemptedId: RAHASIA_B_DOC_ID });
  });

  test("cross-tenant preview returns 404 and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest(`/documents/${RAHASIA_B_DOC_ID}/preview`, {
        token: TOKENS.memberA,
      }),
    );

    expect(res.status).toBe(404);
    expect(await errorOf(res)).toEqual({
      code: "NOT_FOUND",
      message: "Data tidak ditemukan",
    });
    expect(app.activityRepository.events).toHaveLength(1);
    expect(app.activityRepository.events[0]?.action).toBe("access.denied");
    expect(app.activityRepository.events[0]?.tenantId).toBe(TENANT_A.id);
  });

  test("cross-tenant versions listing returns 404 and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest(`/documents/${RAHASIA_B_DOC_ID}/versions`, {
        token: TOKENS.memberA,
      }),
    );

    expect(res.status).toBe(404);
    expect(await errorOf(res)).toEqual({
      code: "NOT_FOUND",
      message: "Data tidak ditemukan",
    });
    expect(app.activityRepository.events).toHaveLength(1);
    expect(app.activityRepository.events[0]?.action).toBe("access.denied");
    expect(app.activityRepository.events[0]?.tenantId).toBe(TENANT_A.id);
  });

  test("legitimate document access within tenant succeeds without access.denied event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest(`/documents/${DOC_A_ID}`, {
        token: TOKENS.memberA,
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(DOC_A_ID);
    // No denial audit event recorded
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
    expect(event).toBeDefined();
    expect(event?.tenantId).toBe(TENANT_B.id);
    expect(event?.action).toBe("access.denied");
    expect(event?.outcome).toBe("denied");
  });
});
