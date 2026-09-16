import { describe, expect, test } from "bun:test";
import { asTenantId, asUserId } from "@archiva/shared";
import { createTenancyService } from "./service.ts";
import { inMemoryTenancyRepository } from "./testing/in-memory-repository.ts";

const TENANT = asTenantId("11111111-1111-4111-8111-111111111111");
const ACTOR = asUserId("22222222-2222-4222-8222-222222222222");
const clock = { now: () => new Date("2026-09-10T00:00:00.000Z") };

const build = (opts?: { quotaBytes?: number; usedBytes?: number }) => {
  const repository = inMemoryTenancyRepository(opts);
  return { repository, service: createTenancyService({ repository, clock }) };
};

describe("resolveTenant", () => {
  const tenant = {
    id: TENANT,
    name: "PT Contoh Baru",
    subdomain: "contohbaru",
    status: "active" as const,
  };
  const service = createTenancyService({
    repository: inMemoryTenancyRepository({ tenants: [tenant] }),
    clock,
  });

  test("resolves a subdomain regardless of case", async () => {
    expect(await service.resolveTenant("ContohBaru")).toEqual(tenant);
  });

  test("an unknown subdomain resolves to null", async () => {
    expect(await service.resolveTenant("tidak-ada")).toBeNull();
  });
});

describe("configuration", () => {
  test("an unset key resolves to its default", async () => {
    const { service } = build();
    expect(await service.getConfigValue(TENANT, "max_file_size_mb")).toBe(20);
  });

  test("rejects a non-integer value", async () => {
    // AC-42.03
    const { service } = build();
    const result = await service.setConfigValue(TENANT, "max_file_size_mb", 20.5, ACTOR);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("InvalidConfigValue");
  });

  test("rejects a value outside the key range", async () => {
    // AC-42.04
    const { service } = build();
    const result = await service.setConfigValue(TENANT, "max_file_size_mb", 500, ACTOR);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("ValueOutOfRange");
  });

  test("refuses the quota key regardless of caller", async () => {
    // technical-specs/05-module-definitions.md 5.1 invariant 2
    const { service } = build();
    const result = await service.setConfigValue(TENANT, "storage_quota_gb", 100, ACTOR);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("NotEditableByTenant");
  });

  test("reset returns the key to its default", async () => {
    // AC-42.05
    const { service } = build();
    await service.setConfigValue(TENANT, "max_file_size_mb", 50, ACTOR);
    expect(await service.getConfigValue(TENANT, "max_file_size_mb")).toBe(50);
    await service.resetConfigValue(TENANT, "max_file_size_mb", ACTOR);
    expect(await service.getConfigValue(TENANT, "max_file_size_mb")).toBe(20);
  });
});

describe("quota reservation", () => {
  test("reserving counts against outstanding reservations, not just committed use", async () => {
    // AC-35.04: the third file in a batch is refused inside the same request.
    const { service } = build({ quotaBytes: 100 });
    const first = await service.reserveQuota(TENANT, 60);
    const second = await service.reserveQuota(TENANT, 60);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
  });

  test("releasing a reservation returns the capacity", async () => {
    // AC-01.07: an interrupted upload consumes nothing.
    const { service } = build({ quotaBytes: 100 });
    const first = await service.reserveQuota(TENANT, 60);
    expect(first.ok).toBe(true);
    if (first.ok) await service.releaseQuota(first.value);
    const second = await service.reserveQuota(TENANT, 60);
    expect(second.ok).toBe(true);
  });

  test("committed bytes stay consumed", async () => {
    const { service, repository } = build({ quotaBytes: 100 });
    const first = await service.reserveQuota(TENANT, 60);
    if (first.ok) await service.commitQuota(first.value);
    expect((await repository.usage(TENANT)).usedBytes).toBe(60);
    expect((await service.reserveQuota(TENANT, 60)).ok).toBe(false);
  });
});

describe("createTenant", () => {
  test("creates a tenant with active status and stored quota", async () => {
    // AC-43.01
    const { service } = build();
    const result = await service.createTenant(
      { name: "PT Contoh Baru", subdomain: "contohbaru", storageQuotaGb: 50 },
      ACTOR,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("PT Contoh Baru");
    expect(result.value.status).toBe("active");
    expect(result.value.storageQuotaBytes).toBe(50 * 1024 ** 3);
    expect(result.value.storageUsedBytes).toBe(0);
  });

  test("rejects a duplicate name", async () => {
    // AC-43.01
    const { service } = build();
    await service.createTenant({ name: "PT Unik", subdomain: "ptuniq", storageQuotaGb: 50 }, ACTOR);
    const result = await service.createTenant(
      { name: "PT Unik", subdomain: "ptuniq2", storageQuotaGb: 50 },
      ACTOR,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("TenantNameTaken");
  });

  test("rejects a duplicate subdomain", async () => {
    // AC-43.01
    const { service } = build();
    await service.createTenant(
      { name: "PT Alfa", subdomain: "samadomain", storageQuotaGb: 50 },
      ACTOR,
    );
    const result = await service.createTenant(
      { name: "PT Beta", subdomain: "samadomain", storageQuotaGb: 50 },
      ACTOR,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("SubdomainTaken");
  });
});

describe("listTenants", () => {
  test("returns created tenants with storagePercent derived", async () => {
    // AC-43.01
    const { service } = build();
    await service.createTenant(
      { name: "PT Daftar", subdomain: "daftar", storageQuotaGb: 20 },
      ACTOR,
    );
    const { rows, total } = await service.listTenants({
      sort: "createdAt",
      order: "desc",
      page: 1,
      limit: 10,
    });
    expect(total).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("PT Daftar");
    expect(rows[0]?.storagePercent).toBe(0);
    expect(rows[0]?.documentCount).toBe(0);
    expect(rows[0]?.userCount).toBe(0);
  });

  test("filters by q against name and subdomain", async () => {
    const { service } = build();
    await service.createTenant({ name: "PT Alpha", subdomain: "alpha", storageQuotaGb: 10 }, ACTOR);
    await service.createTenant({ name: "PT Beta", subdomain: "beta", storageQuotaGb: 10 }, ACTOR);
    const { rows, total } = await service.listTenants({
      q: "alpha",
      sort: "name",
      order: "asc",
      page: 1,
      limit: 10,
    });
    expect(total).toBe(1);
    expect(rows[0]?.name).toBe("PT Alpha");
  });

  test("paginates results correctly", async () => {
    const { service } = build();
    await service.createTenant({ name: "PT Satu", subdomain: "satu", storageQuotaGb: 10 }, ACTOR);
    await service.createTenant({ name: "PT Dua", subdomain: "dua", storageQuotaGb: 10 }, ACTOR);
    await service.createTenant({ name: "PT Tiga", subdomain: "tiga", storageQuotaGb: 10 }, ACTOR);
    const { rows, total } = await service.listTenants({
      sort: "name",
      order: "asc",
      page: 2,
      limit: 2,
    });
    expect(total).toBe(3);
    expect(rows).toHaveLength(1);
  });
});
