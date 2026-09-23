import { describe, expect, test } from "bun:test";
import type { ConfigParameter } from "@archiva/shared";
import { buildTestApp, errorOf, TOKENS, tenantRequest } from "../testing/test-app.ts";

describe("GET /configuration", () => {
  // AC-42.01: Melihat daftar parameter konfigurasi
  test("admin_tenant retrieves all three configuration parameters with defaults and metadata", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration", {
        token: TOKENS.adminA,
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: ConfigParameter[]; meta: { total: number } };
    expect(body.meta.total).toBe(3);
    expect(body.data).toHaveLength(3);

    const [maxSize, pendingDays, quota] = body.data;
    expect(maxSize).toEqual({
      key: "max_file_size_mb",
      label: "Max File Size",
      value: 20,
      defaultValue: 20,
      unit: "MB",
      min: 1,
      max: 200,
      editable: true,
      isDefault: true,
      updatedAt: null,
      updatedBy: null,
    });

    expect(pendingDays).toEqual({
      key: "pending_confirmation_days",
      label: "Batas Waktu Konfirmasi Kategori",
      value: 7,
      defaultValue: 7,
      unit: "hari",
      min: 1,
      max: 90,
      editable: true,
      isDefault: true,
      updatedAt: null,
      updatedBy: null,
    });

    expect(quota).toEqual({
      key: "storage_quota_gb",
      label: "Kuota Penyimpanan",
      value: 50,
      defaultValue: 50,
      unit: "GB",
      min: 1,
      max: 10000,
      editable: false,
      isDefault: true,
      updatedAt: null,
      updatedBy: null,
    });
  });

  // AC-42.01: Member dan Head of Team dilarang (403 FORBIDDEN + access.denied audit)
  test("member is refused with 403 and access.denied audit event", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration", {
        token: TOKENS.memberA,
      }),
    );

    expect(res.status).toBe(403);
    expect(await errorOf(res)).toEqual({
      code: "FORBIDDEN",
      message: "Anda tidak memiliki akses ke halaman ini",
    });

    const events = app.activityRepository.events.filter((e) => e.action === "access.denied");
    expect(events.length).toBeGreaterThan(0);
  });

  test("head_of_team is refused with 403", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration", {
        token: TOKENS.headOfTeamA,
      }),
    );

    expect(res.status).toBe(403);
    expect((await errorOf(res))?.code).toBe("FORBIDDEN");
  });

  // AC-42.01: Unauthenticated caller is refused with 401
  test("unauthenticated caller is refused with 401 UNAUTHENTICATED", async () => {
    const app = buildTestApp();
    const res = await app.request(tenantRequest("/configuration"));

    expect(res.status).toBe(401);
    expect((await errorOf(res))?.code).toBe("UNAUTHENTICATED");
  });

  // Cross-tenant access returns 404, not 403
  test("cross-tenant caller returns 404 NOT_FOUND", async () => {
    const app = buildTestApp();
    const res = await app.request(
      tenantRequest("/configuration", {
        subdomain: "mitra-rahasia",
        token: TOKENS.adminA,
      }),
    );

    expect(res.status).toBe(404);
    expect((await errorOf(res))?.code).toBe("NOT_FOUND");
  });
});
