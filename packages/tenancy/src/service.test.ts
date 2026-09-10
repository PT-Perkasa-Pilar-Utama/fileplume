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
