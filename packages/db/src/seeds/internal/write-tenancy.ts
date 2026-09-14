import { sql } from "drizzle-orm";
import {
  categories,
  categoryPermissions,
  tenantConfig,
  tenants,
  users,
} from "../../schema/index.ts";
import type { SeedCategory, SeedConfigKey, SeedUser } from "./dev-tenant.ts";
import type { SeedTx } from "./seed-transaction.ts";

export type TenancyIds = {
  tenantId: string;
  userIdByEmail: Map<string, string>;
  categoryIdByName: Map<string, string>;
};

export type TenancySeed = {
  tenant: { name: string; subdomain: string };
  users: SeedUser[];
  passwordHash: string;
  config: { key: SeedConfigKey; value: string }[];
  categories: SeedCategory[];
  adminEmail: string;
};

/**
 * Upserts on each table's own natural key, and reads the ids back from what
 * the database actually holds rather than assuming the seed wrote them. A row
 * that already exists under a different id is then reused instead of orphaning
 * every child row that points at it. technical-specs/06-data-model.md 6.11.
 */
export async function writeTenancy(tx: SeedTx, seed: TenancySeed): Promise<TenancyIds> {
  const now = new Date();

  const [tenantRow] = await tx
    .insert(tenants)
    .values({ name: seed.tenant.name, subdomain: seed.tenant.subdomain })
    .onConflictDoUpdate({
      target: tenants.subdomain,
      set: { name: seed.tenant.name, updatedAt: now },
    })
    .returning({ id: tenants.id });
  if (!tenantRow) throw new Error(`seed: tenant ${seed.tenant.subdomain} was not written`);
  const tenantId = tenantRow.id;

  const userRows = await tx
    .insert(users)
    .values(
      seed.users.map((user) => ({
        tenantId: user.role === "super_admin" ? null : tenantId,
        email: user.email,
        passwordHash: seed.passwordHash,
        name: user.name,
        role: user.role,
      })),
    )
    // password_hash is deliberately absent from the update: argon2 salts every
    // hash, so rewriting it would leave a different row on every run.
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: sql`excluded.name`,
        role: sql`excluded.role`,
        tenantId: sql`excluded.tenant_id`,
        updatedAt: now,
      },
    })
    .returning({ id: users.id, email: users.email });

  const userIdByEmail = new Map(userRows.map((row) => [row.email, row.id]));
  const adminId = userIdByEmail.get(seed.adminEmail);
  if (!adminId) throw new Error(`seed: admin ${seed.adminEmail} was not written`);

  if (seed.config.length > 0) {
    await tx
      .insert(tenantConfig)
      .values(
        seed.config.map((entry) => ({
          tenantId,
          key: entry.key,
          value: entry.value,
          updatedBy: adminId,
        })),
      )
      .onConflictDoUpdate({
        target: [tenantConfig.tenantId, tenantConfig.key],
        set: { value: sql`excluded.value`, updatedBy: adminId, updatedAt: now },
      });
  }

  const categoryRows = await tx
    .insert(categories)
    .values(
      seed.categories.map((category) => ({
        tenantId,
        name: category.name,
        isSystem: category.isSystem,
        createdBy: adminId,
      })),
    )
    .onConflictDoUpdate({
      target: [categories.tenantId, categories.name],
      set: { isSystem: sql`excluded.is_system` },
    })
    .returning({ id: categories.id, name: categories.name });

  const categoryIdByName = new Map(categoryRows.map((row) => [row.name, row.id]));

  await tx
    .insert(categoryPermissions)
    .values(
      seed.categories.map((category) => {
        const categoryId = categoryIdByName.get(category.name);
        if (!categoryId) throw new Error(`seed: category ${category.name} was not written`);
        return {
          categoryId,
          tenantId,
          downloadActive: category.downloadActive,
          updatedBy: adminId,
        };
      }),
    )
    .onConflictDoUpdate({
      target: categoryPermissions.categoryId,
      set: { downloadActive: sql`excluded.download_active`, updatedBy: adminId, updatedAt: now },
    });

  return { tenantId, userIdByEmail, categoryIdByName };
}
