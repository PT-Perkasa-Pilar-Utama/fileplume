import { describe, expect, test } from "bun:test";
import {
  asTenantId,
  asUserId,
  STORAGE_FULL_MESSAGE,
  STORAGE_WARNING_MESSAGE,
} from "@archiva/shared";
import { createTenancyService } from "./service.ts";
import { inMemoryTenancyRepository } from "./testing/in-memory-repository.ts";

const TENANT = asTenantId("11111111-1111-4111-8111-111111111111");
const ACTOR = asUserId("22222222-2222-4222-8222-222222222222");
const ACTOR_NAME = "Sari Dewi";
const clock = { now: () => new Date("2026-09-10T00:00:00.000Z") };

const build = (opts?: { quotaBytes?: number; usedBytes?: number }) => {
  const repository = inMemoryTenancyRepository({
    ...opts,
    users: [{ id: ACTOR, name: ACTOR_NAME }],
  });
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

  test("getConfiguration returns all three keys with defaults", async () => {
    // AC-42.01
    const { service } = build();
    const config = await service.getConfiguration(TENANT);
    expect(config).toHaveLength(3);

    const [maxSize, pendingDays, quota] = config;
    expect(maxSize?.key).toBe("max_file_size_mb");
    expect(maxSize?.value).toBe(20);
    expect(maxSize?.defaultValue).toBe(20);
    expect(maxSize?.unit).toBe("MB");
    expect(maxSize?.min).toBe(1);
    expect(maxSize?.max).toBe(200);
    expect(maxSize?.editable).toBe(true);
    expect(maxSize?.isDefault).toBe(true);
    expect(maxSize?.updatedAt).toBeNull();
    expect(maxSize?.updatedBy).toBeNull();

    expect(pendingDays?.key).toBe("pending_confirmation_days");
    expect(pendingDays?.value).toBe(7);
    expect(pendingDays?.unit).toBe("hari");
    expect(pendingDays?.isDefault).toBe(true);

    expect(quota?.key).toBe("storage_quota_gb");
    expect(quota?.value).toBe(50);
    expect(quota?.unit).toBe("GB");
    expect(quota?.editable).toBe(false);
    expect(quota?.isDefault).toBe(true);
  });

  test("reset returns the key to its default", async () => {
    // AC-42.05
    const { service } = build();
    const updateResult = await service.setConfigValue(TENANT, "max_file_size_mb", 50, ACTOR);
    expect(updateResult.ok).toBe(true);
    if (updateResult.ok) {
      expect(updateResult.value.previousValue).toBe(20);
      expect(updateResult.value.parameter.value).toBe(50);
      expect(updateResult.value.parameter.isDefault).toBe(false);
      expect(updateResult.value.parameter.updatedBy).toEqual({ id: ACTOR, name: ACTOR_NAME });
    }
    expect(await service.getConfigValue(TENANT, "max_file_size_mb")).toBe(50);

    const resetResult = await service.resetConfigValue(TENANT, "max_file_size_mb", ACTOR);
    expect(resetResult.ok).toBe(true);
    if (resetResult.ok) {
      expect(resetResult.value.value).toBe(20);
      expect(resetResult.value.isDefault).toBe(true);
      expect(resetResult.value.updatedAt).toBeNull();
      expect(resetResult.value.updatedBy).toBeNull();
    }
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

  test("reverting a commit returns the capacity", async () => {
    // AC-01.08: the batch rollback debits files committed before the expiry.
    const { service, repository } = build({ quotaBytes: 100 });
    const first = await service.reserveQuota(TENANT, 60);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await service.commitQuota(first.value);
    await service.revertCommit(first.value);
    expect((await repository.usage(TENANT)).usedBytes).toBe(0);
    expect((await service.reserveQuota(TENANT, 60)).ok).toBe(true);
  });

  test("reverting twice fails loudly instead of double-debiting", async () => {
    const { service } = build({ quotaBytes: 100 });
    const first = await service.reserveQuota(TENANT, 60);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await service.commitQuota(first.value);
    await service.revertCommit(first.value);
    await expect(service.revertCommit(first.value)).rejects.toThrow();
  });

  test("reservation expires after 15 minutes releasing capacity", async () => {
    let now = new Date("2026-09-10T10:00:00.000Z");
    const mutableClock = { now: () => now };
    const repository = inMemoryTenancyRepository({ quotaBytes: 100 });
    const service = createTenancyService({ repository, clock: mutableClock });

    const first = await service.reserveQuota(TENANT, 60);
    expect(first.ok).toBe(true);

    const secondBeforeExpiry = await service.reserveQuota(TENANT, 60);
    expect(secondBeforeExpiry.ok).toBe(false);

    // Advance past 15 minutes
    now = new Date(now.getTime() + 16 * 60 * 1000);

    const secondAfterExpiry = await service.reserveQuota(TENANT, 60);
    expect(secondAfterExpiry.ok).toBe(true);
  });

  test("sweeper deletes expired reservations", async () => {
    let now = new Date("2026-09-10T10:00:00.000Z");
    const mutableClock = { now: () => now };
    const repository = inMemoryTenancyRepository({ quotaBytes: 100 });
    const service = createTenancyService({ repository, clock: mutableClock });

    await service.reserveQuota(TENANT, 30);
    expect(repository.reservations).toHaveLength(1);

    // Not yet expired
    expect(await service.sweepExpiredReservations()).toBe(0);
    expect(repository.reservations).toHaveLength(1);

    // Advance past 15 minutes
    now = new Date(now.getTime() + 16 * 60 * 1000);

    expect(await service.sweepExpiredReservations()).toBe(1);
    expect(repository.reservations).toHaveLength(0);
  });
});

describe("getQuotaUsage", () => {
  test("AC-35.01: reports usage at 25% with level ok and null message", async () => {
    const { service } = build({ quotaBytes: 100, usedBytes: 25 });
    const usage = await service.getQuotaUsage(TENANT);

    expect(usage.usedBytes).toBe(25);
    expect(usage.quotaBytes).toBe(100);
    expect(usage.percent).toBe(25);
    expect(usage.level).toBe("ok");
    expect(usage.message).toBeNull();
  });

  test("AC-35.02: reports warning at 80% with Indonesian warning message", async () => {
    const { service } = build({ quotaBytes: 100, usedBytes: 80 });
    const usage = await service.getQuotaUsage(TENANT);

    expect(usage.usedBytes).toBe(80);
    expect(usage.quotaBytes).toBe(100);
    expect(usage.percent).toBe(80);
    expect(usage.level).toBe("warning");
    // Verbatim from AC-35.02 via api-specs/04-configuration.md 4.5.
    expect(usage.message).toBe("Kapasitas penyimpanan hampir penuh");
    expect(usage.message).toBe(STORAGE_WARNING_MESSAGE);
  });

  test("AC-35.03: reports full at 100% with Indonesian full message", async () => {
    const { service } = build({ quotaBytes: 100, usedBytes: 100 });
    const usage = await service.getQuotaUsage(TENANT);

    expect(usage.usedBytes).toBe(100);
    expect(usage.quotaBytes).toBe(100);
    expect(usage.percent).toBe(100);
    expect(usage.level).toBe("full");
    // Verbatim from AC-35.03 via api-specs/04-configuration.md 4.5.
    expect(usage.message).toBe(
      "Kapasitas penyimpanan penuh. Hapus atau arsipkan dokumen lama untuk melanjutkan",
    );
    expect(usage.message).toBe(STORAGE_FULL_MESSAGE);
  });

  test("zero quota with stored bytes reports full, not ok", async () => {
    // api-specs/04-configuration.md 4.5. Defensive: storage_quota_gb min is 1,
    // so this is unreachable through setConfigValue, but the indicator must
    // still agree with the upload refusal.
    const repository = inMemoryTenancyRepository({
      allTenants: [
        {
          id: TENANT,
          name: "PT Contoh Baru",
          subdomain: "contohbaru",
          status: "active",
          storageQuotaBytes: 0,
          storageUsedBytes: 10,
          createdAt: new Date(),
        },
      ],
    });
    const service = createTenancyService({ repository, clock });
    const usage = await service.getQuotaUsage(TENANT);

    expect(usage.percent).toBe(100);
    expect(usage.level).toBe("full");
    expect(usage.message).toBe(STORAGE_FULL_MESSAGE);
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
