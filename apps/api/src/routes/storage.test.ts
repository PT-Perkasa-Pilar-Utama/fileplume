import { describe, expect, test } from "bun:test";
import { STORAGE_FULL_MESSAGE, STORAGE_WARNING_MESSAGE, type StorageView } from "@archiva/shared";
import { inMemoryTenancyRepository } from "@archiva/tenancy";
import {
  buildTestApp,
  errorOf,
  TENANT_A,
  TENANT_B,
  TOKENS,
  tenantRequest,
} from "../testing/test-app.ts";

describe("GET /storage (BE-S2-02, US-35)", () => {
  // AC-35.01: Melihat informasi kapasitas penyimpanan
  test("AC-35.01: member reads storage usage at 25% with level ok and null message", async () => {
    const quotaBytes = 53_687_091_200; // 50 GB
    const usedBytes = 13_421_772_800; // 12.5 GB = 25%
    const tenancyRepository = inMemoryTenancyRepository({
      tenants: [TENANT_A, TENANT_B],
      quotaBytes,
      usedBytes,
    });
    const app = buildTestApp(undefined, { tenancyRepository });

    const res = await app.request(
      tenantRequest("/storage", {
        token: TOKENS.memberA,
      }),
    );

    expect(res.status).toBe(200);
    // Typed test fixture: the envelope shape is asserted by the caller.
    const body = (await res.json()) as { data: StorageView };
    expect(body.data).toEqual({
      usedBytes,
      quotaBytes,
      percent: 25,
      level: "ok",
      message: null,
    });
  });

  // AC-35.02: Mendapat peringatan kapasitas hampir penuh
  test("AC-35.02: member reads storage usage at 80% with level warning and warning message", async () => {
    const quotaBytes = 100_000_000;
    const usedBytes = 80_000_000; // 80%
    const tenancyRepository = inMemoryTenancyRepository({
      tenants: [TENANT_A, TENANT_B],
      quotaBytes,
      usedBytes,
    });
    const app = buildTestApp(undefined, { tenancyRepository });

    const res = await app.request(
      tenantRequest("/storage", {
        token: TOKENS.memberA,
      }),
    );

    expect(res.status).toBe(200);
    // Typed test fixture: the envelope shape is asserted by the caller.
    const body = (await res.json()) as { data: StorageView };
    expect(body.data).toEqual({
      usedBytes,
      quotaBytes,
      percent: 80,
      level: "warning",
      // Verbatim from AC-35.02 via api-specs/04-configuration.md 4.5.
      message: "Kapasitas penyimpanan hampir penuh",
    });
    expect(body.data.message).toBe(STORAGE_WARNING_MESSAGE);
  });

  // AC-35.03: Upload ditolak saat kapasitas penuh (Negative Path)
  test("AC-35.03: member reads storage usage at 100% with level full and full message", async () => {
    const quotaBytes = 100_000_000;
    const usedBytes = 100_000_000; // 100%
    const tenancyRepository = inMemoryTenancyRepository({
      tenants: [TENANT_A, TENANT_B],
      quotaBytes,
      usedBytes,
    });
    const app = buildTestApp(undefined, { tenancyRepository });

    const res = await app.request(
      tenantRequest("/storage", {
        token: TOKENS.memberA,
      }),
    );

    expect(res.status).toBe(200);
    // Typed test fixture: the envelope shape is asserted by the caller.
    const body = (await res.json()) as { data: StorageView };
    expect(body.data).toEqual({
      usedBytes,
      quotaBytes,
      percent: 100,
      level: "full",
      // Verbatim from AC-35.03 via api-specs/04-configuration.md 4.5.
      message: "Kapasitas penyimpanan penuh. Hapus atau arsipkan dokumen lama untuk melanjutkan",
    });
    expect(body.data.message).toBe(STORAGE_FULL_MESSAGE);
  });

  // Security: cross-tenant access returns 404 and writes denied audit event
  test("cross-tenant storage access returns 404 and records denied audit event", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest("/storage", {
        subdomain: TENANT_B.subdomain,
        token: TOKENS.memberA,
      }),
    );

    expect(res.status).toBe(404);
    const err = await errorOf(res);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Data tidak ditemukan");

    expect(app.activityRepository.events).toHaveLength(1);
    const event = app.activityRepository.events[0];
    expect(event?.tenantId).toBe(TENANT_A.id);
    expect(event?.action).toBe("access.denied");
    expect(event?.outcome).toBe("denied");
  });

  // Security: unauthenticated access returns 401 UNAUTHENTICATED
  test("unauthenticated access to /storage returns 401", async () => {
    const app = buildTestApp();

    const res = await app.request(tenantRequest("/storage"));

    expect(res.status).toBe(401);
    const err = await errorOf(res);
    expect(err.code).toBe("UNAUTHENTICATED");
    expect(err.message).toBe("Sesi Anda telah berakhir. Silakan login kembali");
  });

  // Security: super_admin does not clear member role floor (403 FORBIDDEN)
  test("super_admin targeting admin host is refused with 403", async () => {
    const app = buildTestApp();

    const res = await app.request(
      tenantRequest("/storage", {
        subdomain: "admin",
        token: TOKENS.superAdmin,
      }),
    );

    expect(res.status).toBe(403);
  });
});
