import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { createDb, type Db, schema } from "@archiva/db";
import { asCategoryId, asTenantId, asUserId } from "@archiva/shared";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { createDrizzleClassificationRepository } from "./repository.ts";

let db: Db;
let stop: () => Promise<void>;
beforeAll(async () => {
  const container = await new PostgreSqlContainer(
    "postgres:17.2@sha256:3267c505060a0052e5aa6e5175a7b41ab6b04da2f8c4540fc6e98a37210aa2d3",
  ).start();
  const handle = createDb({ url: container.getConnectionUri(), max: 4 });
  db = handle.db;
  await migrate(db, {
    migrationsFolder: join(Bun.resolveSync("@archiva/db", import.meta.dir), "..", "migrations"),
  });
  stop = async () => {
    await handle.client.close();
    await container.stop();
  };
}, 120_000);
afterAll(async () => {
  if (stop) await stop();
});

test("AC-45.01 and AC-45.02: inactive permission, audit and case-insensitive uniqueness persist", async () => {
  const [tenant] = await db
    .insert(schema.tenants)
    .values({ name: "Test", subdomain: "test", storageQuotaBytes: 100 })
    .returning();
  if (!tenant) throw new Error("missing tenant");
  const [user] = await db
    .insert(schema.users)
    .values({
      tenantId: tenant.id,
      name: "Head",
      email: "head@example.test",
      passwordHash: "fixture",
      role: "head_of_team",
    })
    .returning();
  if (!user) throw new Error("missing user");
  const repo = createDrizzleClassificationRepository(db, async (tx, event) => {
    await tx.insert(schema.auditEvents).values(event);
  });
  const tenantId = asTenantId(tenant.id);
  const actor = asUserId(user.id);
  const first = await repo.createCategory(tenantId, "Reporting", actor);
  expect(first.ok).toBe(true);
  if (!first.ok) throw new Error("create failed");
  expect(first.value.downloadActive).toBe(false);
  const failing = createDrizzleClassificationRepository(db, async () => {
    throw new Error("audit unavailable");
  });
  await expect(failing.createCategory(tenantId, "Rollback", actor)).rejects.toThrow(
    "audit unavailable",
  );
  expect(
    await db.select().from(schema.categories).where(eq(schema.categories.name, "Rollback")),
  ).toHaveLength(0);
  await expect(
    failing.renameCategory(tenantId, asCategoryId(first.value.id), "Renamed", actor),
  ).rejects.toThrow("audit unavailable");
  expect((await repo.findCategory(tenantId, asCategoryId(first.value.id)))?.name).toBe("Reporting");
  const duplicate = await repo.createCategory(tenantId, "reporting", actor);
  expect(duplicate).toEqual({ ok: false, error: { kind: "DuplicateName" } });
  expect(await db.select().from(schema.categoryPermissions)).toHaveLength(1);
  const createdEvents = await db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.subjectId, first.value.id));
  expect(createdEvents).toHaveLength(1);
  expect(createdEvents[0]).toMatchObject({
    tenantId,
    actorId: actor,
    action: "category.create",
    subjectType: "category",
    subjectId: first.value.id,
    outcome: "allowed",
    metadata: null,
  });
  const system = await db
    .insert(schema.categories)
    .values({ tenantId, name: "Uncategorized", isSystem: true, createdBy: actor })
    .returning();
  if (!system[0]) throw new Error("missing system category");
  const immutable = await repo.renameCategory(tenantId, asCategoryId(system[0].id), "Other", actor);
  expect(immutable).toEqual({ ok: false, error: { kind: "SystemCategoryImmutable" } });
  const renamed = await repo.renameCategory(
    tenantId,
    asCategoryId(first.value.id),
    "Reports",
    actor,
  );
  expect(renamed.ok).toBe(true);
  const events = await db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.subjectId, first.value.id));
  expect(events).toHaveLength(2);
  expect(events).toContainEqual(
    expect.objectContaining({
      tenantId,
      actorId: actor,
      action: "category.create",
      subjectType: "category",
      subjectId: first.value.id,
      outcome: "allowed",
      metadata: { action: "rename", previousName: "Reporting", name: "Reports" },
    }),
  );
});

test("category search treats SQL wildcard characters as literal substrings", async () => {
  const [tenant] = await db
    .insert(schema.tenants)
    .values({ name: "Search", subdomain: "search", storageQuotaBytes: 100 })
    .returning();
  if (!tenant) throw new Error("missing tenant");
  const [user] = await db
    .insert(schema.users)
    .values({
      tenantId: tenant.id,
      name: "Head",
      email: "search@example.test",
      passwordHash: "fixture",
      role: "head_of_team",
    })
    .returning();
  if (!user) throw new Error("missing user");
  const repo = createDrizzleClassificationRepository(db, async (tx, event) => {
    await tx.insert(schema.auditEvents).values(event);
  });
  const tenantId = asTenantId(tenant.id);
  for (const name of ["plain", "under_score", "percent%name", "back\\slash"]) {
    const result = await repo.createCategory(tenantId, name, asUserId(user.id));
    expect(result.ok).toBe(true);
  }
  for (const { q, name } of [
    { q: "_", name: "under_score" },
    { q: "%", name: "percent%name" },
    { q: "\\", name: "back\\slash" },
  ]) {
    const result = await repo.listCategoryViews(tenantId, {
      page: 1,
      limit: 10,
      sort: "name",
      order: "asc",
      q,
    });
    expect(result.rows.map((row) => row.name)).toEqual([name]);
    expect(result.total).toBe(1);
  }
});
