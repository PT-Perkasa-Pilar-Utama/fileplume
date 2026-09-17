import { describe, expect, test } from "bun:test";
import {
  buildTestApp,
  type ErrorBody,
  TENANT_A,
  TOKENS,
  tenantRequest,
} from "../testing/test-app.ts";
import { MOCK_CATEGORY } from "./mocks.ts";

/**
 * Asserts that an in-tenant admin route access by an under-privileged role
 * returns 403 FORBIDDEN, a sterile error body with exact Indonesian copy,
 * and an access.denied audit event with route path and floor metadata.
 *
 * References:
 * - CODING_STANDARD.md 8.4, 8.5
 * - api-specs/01-conventions.md 1.8
 * - business/acceptance-criteria-breakdown/acceptance-criteria-sprint-1.md AC-41.05
 */
async function assertAdminForbidden(
  res: Response,
  app: ReturnType<typeof buildTestApp>,
  expected: { path: string; floor: string },
): Promise<void> {
  expect(res.status).toBe(403);
  // Typed test fixture: verify envelope contains only the sterile error object without admin data
  const body = (await res.json()) as ErrorBody;
  expect(Object.keys(body)).toEqual(["error"]);
  expect(Object.keys(body.error)).toEqual(["code", "message"]);
  expect(body.error).toEqual({
    code: "FORBIDDEN",
    message: "Anda tidak memiliki akses ke halaman ini",
  });

  expect(app.activityRepository.events).toHaveLength(1);
  const event = app.activityRepository.events[0];
  expect(event?.tenantId).toBe(TENANT_A.id);
  expect(event?.actorId).toBeDefined();
  expect(typeof event?.actorId).toBe("string");
  expect(event?.action).toBe("access.denied");
  expect(event?.outcome).toBe("denied");
  expect(event?.subjectType).toBe("route");
  expect(event?.subjectId).toBeNull();
  expect(event?.metadata).toEqual(expected);
}

describe("in-tenant admin route refusal (AC-41.05, BE-S1-05)", () => {
  // AC-41.05: Menolak akses rute administrasi melalui akses langsung (Negative Path)
  // Given Saya seorang Member Team, And saya telah berhasil login
  // When Saya mengakses endpoint halaman "Permission Category" secara langsung
  // Then Sistem mengembalikan status 403, And tidak ada data administrasi yang dikembalikan,
  // And upaya akses tercatat di audit log.
  test("AC-41.05: member direct access to Permission Category endpoint returns 403, sterile body, and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest(`/categories/${MOCK_CATEGORY.id}/download-permission`, {
        method: "PUT",
        token: TOKENS.memberA,
        body: JSON.stringify({ downloadActive: true }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    await assertAdminForbidden(res, app, {
      path: `/api/v1/categories/${MOCK_CATEGORY.id}/download-permission`,
      floor: "head_of_team",
    });
  });

  test("AC-41.05: member direct access to category creation returns 403, sterile body, and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest("/categories", {
        method: "POST",
        token: TOKENS.memberA,
        body: JSON.stringify({ name: "Kategori Rahasia" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    await assertAdminForbidden(res, app, {
      path: "/api/v1/categories",
      floor: "head_of_team",
    });
  });

  test("AC-41.05: member direct access to category rename returns 403, sterile body, and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest(`/categories/${MOCK_CATEGORY.id}`, {
        method: "PATCH",
        token: TOKENS.memberA,
        body: JSON.stringify({ name: "Nama Baru" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    await assertAdminForbidden(res, app, {
      path: `/api/v1/categories/${MOCK_CATEGORY.id}`,
      floor: "head_of_team",
    });
  });

  test("AC-41.05: member direct access to configuration read returns 403, sterile body, and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest("/configuration", {
        token: TOKENS.memberA,
      }),
    );

    await assertAdminForbidden(res, app, {
      path: "/api/v1/configuration",
      floor: "admin_tenant",
    });
  });

  test("AC-41.05: member direct access to audit trail returns 403, sterile body, and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest("/audit-events", {
        token: TOKENS.memberA,
      }),
    );

    await assertAdminForbidden(res, app, {
      path: "/api/v1/audit-events",
      floor: "head_of_team",
    });
  });

  test("AC-41.05: member direct access to analytics dashboard returns 403, sterile body, and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest("/analytics/dashboard", {
        token: TOKENS.memberA,
      }),
    );

    await assertAdminForbidden(res, app, {
      path: "/api/v1/analytics/dashboard",
      floor: "head_of_team",
    });
  });

  test("AC-41.05: member direct access to tenant management returns 403, sterile body, and writes audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest("/tenants", {
        token: TOKENS.memberA,
      }),
    );

    await assertAdminForbidden(res, app, {
      path: "/api/v1/tenants",
      floor: "super_admin",
    });
  });

  test("server refuses what UI hides: head_of_team legitimately accesses category permission and audit trail without access.denied", async () => {
    const app = buildTestApp();

    const permRes = await app.request(
      tenantRequest(`/categories/${MOCK_CATEGORY.id}/download-permission`, {
        method: "PUT",
        token: TOKENS.headOfTeamA,
        body: JSON.stringify({ downloadActive: true }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(permRes.status).toBe(200);

    const auditRes = await app.request(
      tenantRequest("/audit-events", {
        token: TOKENS.headOfTeamA,
      }),
    );
    expect(auditRes.status).toBe(200);

    // No access.denied events recorded for authorized access
    const deniedEvents = app.activityRepository.events.filter((e) => e.action === "access.denied");
    expect(deniedEvents).toHaveLength(0);
  });

  test("server refuses what UI hides: admin_tenant legitimately accesses configuration without access.denied", async () => {
    const app = buildTestApp();

    const configRes = await app.request(
      tenantRequest("/configuration", {
        token: TOKENS.adminA,
      }),
    );
    expect(configRes.status).toBe(200);

    const deniedEvents = app.activityRepository.events.filter((e) => e.action === "access.denied");
    expect(deniedEvents).toHaveLength(0);
  });
});
