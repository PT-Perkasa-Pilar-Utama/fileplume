import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { TenantId, UserId } from "@archiva/shared";
import { asTenantId, asUserId } from "@archiva/shared";
import { startTestDatabase } from "./internal/test-database.ts";
import { createDrizzleTenancyRepository } from "./repository.ts";

/**
 * Real Postgres, real migrations. CODING_STANDARD.md 10.5 — a mocked query
 * proves the mock. This is the one thing the in-memory testing/ fixtures
 * cannot prove: that the reservation race is closed at the database, not
 * just in the in-memory model of it.
 */
describe("createDrizzleTenancyRepository", () => {
  let db: Db;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    const started = await startTestDatabase();
    db = started.db;
    stop = started.stop;
  }, 120_000);

  afterAll(async () => {
    await stop();
  });

  async function seedTenant(quotaBytes: number): Promise<TenantId> {
    // api-specs/03-tenants.md 3.1: name is unique across the platform.
    const slug = crypto.randomUUID().slice(0, 8);
    const [row] = await db
      .insert(schema.tenants)
      .values({
        name: `Test Tenant ${slug}`,
        subdomain: `test-${slug}`,
        storageQuotaBytes: quotaBytes,
      })
      .returning({ id: schema.tenants.id });
    if (!row) throw new Error("seedTenant: insert returned no row");
    return asTenantId(row.id);
  }

  async function seedUser(tenantId: TenantId): Promise<UserId> {
    const [row] = await db
      .insert(schema.users)
      .values({
        tenantId,
        email: `${crypto.randomUUID()}@example.test`,
        passwordHash: "not-a-real-hash",
        name: "Test User",
      })
      .returning({ id: schema.users.id });
    if (!row) throw new Error("seedUser: insert returned no row");
    return asUserId(row.id);
  }

  test("two concurrent reservations that together exceed quota: exactly one succeeds", async () => {
    // AC-35.04: the race is closed by a row lock, not a read-then-check.
    const repository = createDrizzleTenancyRepository(db);
    const tenantId = await seedTenant(100);

    const [first, second] = await Promise.all([
      repository.tryReserve(tenantId, 60),
      repository.tryReserve(tenantId, 60),
    ]);

    expect([first, second].filter((r) => r !== null)).toHaveLength(1);
  });

  test("committing a reservation persists usage across a fresh read", async () => {
    const repository = createDrizzleTenancyRepository(db);
    const tenantId = await seedTenant(100);

    const reservation = await repository.tryReserve(tenantId, 60);
    expect(reservation).not.toBeNull();
    if (reservation) await repository.commitReservation(reservation);

    expect((await repository.usage(tenantId)).usedBytes).toBe(60);
  });

  test("releasing a reservation returns the capacity without touching usage", async () => {
    // AC-01.07: an interrupted upload consumes nothing.
    const repository = createDrizzleTenancyRepository(db);
    const tenantId = await seedTenant(100);

    const reservation = await repository.tryReserve(tenantId, 60);
    expect(reservation).not.toBeNull();
    if (reservation) await repository.releaseReservation(reservation);

    expect((await repository.usage(tenantId)).usedBytes).toBe(0);
    expect(await repository.tryReserve(tenantId, 60)).not.toBeNull();
  });

  test("sweepExpiredReservations deletes expired rows and frees capacity", async () => {
    const repository = createDrizzleTenancyRepository(db);
    const tenantId = await seedTenant(100);

    const past = new Date("2026-09-01T00:00:00.000Z");
    const reservation = await repository.tryReserve(tenantId, 60, past);
    expect(reservation).not.toBeNull();

    // With current time, the reservation expired and sweeping removes it
    const now = new Date("2026-09-01T00:20:00.000Z");
    const swept = await repository.sweepExpiredReservations(now);
    expect(swept).toBeGreaterThanOrEqual(1);

    expect(await repository.tryReserve(tenantId, 100, now)).not.toBeNull();
  });

  test("config value round-trips through upsert, find and delete", async () => {
    const repository = createDrizzleTenancyRepository(db);
    const tenantId = await seedTenant(100);
    const actor = await seedUser(tenantId);

    expect(await repository.findConfigValue(tenantId, "max_file_size_mb")).toBeNull();

    await repository.upsertConfigValue(tenantId, "max_file_size_mb", 50, actor);
    expect(await repository.findConfigValue(tenantId, "max_file_size_mb")).toBe(50);

    await repository.deleteConfigValue(tenantId, "max_file_size_mb", actor);
    expect(await repository.findConfigValue(tenantId, "max_file_size_mb")).toBeNull();
  });

  test("createTenant rejects duplicate name and subdomain against real PostgreSQL", async () => {
    // AC-43.01
    const repository = createDrizzleTenancyRepository(db);
    const tenantId = await seedTenant(100);
    const actor = await seedUser(tenantId);

    const first = await repository.createTenant(
      { name: "Duplikat Corp", subdomain: "duplikat", storageQuotaBytes: 100 },
      actor,
    );
    expect(first.ok).toBe(true);

    const duplicateSubdomain = await repository.createTenant(
      { name: "Beda Corp", subdomain: "duplikat", storageQuotaBytes: 100 },
      actor,
    );
    expect(duplicateSubdomain.ok).toBe(false);
    if (!duplicateSubdomain.ok) {
      expect(duplicateSubdomain.error.kind).toBe("SubdomainTaken");
    }

    const duplicateName = await repository.createTenant(
      { name: "Duplikat Corp", subdomain: "beda-subdomain", storageQuotaBytes: 100 },
      actor,
    );
    expect(duplicateName.ok).toBe(false);
    if (!duplicateName.ok) {
      expect(duplicateName.error.kind).toBe("TenantNameTaken");
    }
  });
});
