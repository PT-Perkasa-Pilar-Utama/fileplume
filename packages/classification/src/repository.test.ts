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
  const repo = createDrizzleClassificationRepository(db);
  const tenantId = asTenantId(tenant.id);
  const actor = asUserId(user.id);
  const first = await repo.createCategory(tenantId, "Reporting", actor);
  expect(first.ok).toBe(true);
  if (!first.ok) throw new Error("create failed");
  expect(first.value.downloadActive).toBe(false);
  const duplicate = await repo.createCategory(tenantId, "reporting", actor);
  expect(duplicate).toEqual({ ok: false, error: { kind: "DuplicateName" } });
  expect(await db.select().from(schema.categoryPermissions)).toHaveLength(1);
  expect(
    await db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.subjectId, first.value.id)),
  ).toHaveLength(1);
  const system = await db
    .insert(schema.categories)
    .values({ tenantId, name: "Uncategorized", isSystem: true, createdBy: actor })
    .returning();
  if (!system[0]) throw new Error("missing system category");
  const immutable = await repo.renameCategory(tenantId, asCategoryId(system[0].id), "Other", actor);
  expect(immutable).toEqual({ ok: false, error: { kind: "SystemCategoryImmutable" } });
});
