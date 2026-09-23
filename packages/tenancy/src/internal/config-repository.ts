import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { TenantId } from "@archiva/shared";
import { and, eq } from "drizzle-orm";
import type { ConfigKey, StoredConfigRow } from "./config-specs.ts";

const { tenantConfig, users } = schema;

/**
 * Config reads for the tenancy data layer. Imported only by
 * `../repository.ts`, so all Drizzle access stays inside the repository
 * layer (CODING_STANDARD 4.4). Extracted to hold `repository.ts` under the
 * 250-line split threshold (CODING_STANDARD 5.1).
 */
export async function fetchConfigEntries(
  db: Db,
  tenantId: TenantId,
  key?: ConfigKey,
): Promise<StoredConfigRow[]> {
  const rows = await db
    .select({
      key: tenantConfig.key,
      value: tenantConfig.value,
      updatedAt: tenantConfig.updatedAt,
      updatedById: users.id,
      updatedByName: users.name,
    })
    .from(tenantConfig)
    .leftJoin(users, eq(tenantConfig.updatedBy, users.id))
    .where(
      key
        ? and(eq(tenantConfig.tenantId, tenantId), eq(tenantConfig.key, key))
        : eq(tenantConfig.tenantId, tenantId),
    );

  // No cast: tenantConfig.key is the pgEnum built from CONFIG_KEY_NAMES in
  // @archiva/shared, so its type is already the closed key union.
  return rows.map((r) => ({
    key: r.key,
    value: Number(r.value),
    updatedAt: r.updatedAt,
    updatedBy:
      r.updatedById && r.updatedByName ? { id: r.updatedById, name: r.updatedByName } : null,
  }));
}

export async function findConfigEntries(db: Db, tenantId: TenantId): Promise<StoredConfigRow[]> {
  return fetchConfigEntries(db, tenantId);
}

export async function findConfigRow(
  db: Db,
  tenantId: TenantId,
  key: ConfigKey,
): Promise<StoredConfigRow | null> {
  const [entry] = await fetchConfigEntries(db, tenantId, key);
  return entry ?? null;
}

export async function findConfigValue(
  db: Db,
  tenantId: TenantId,
  key: ConfigKey,
): Promise<number | null> {
  const [row] = await db
    .select({ value: tenantConfig.value })
    .from(tenantConfig)
    .where(and(eq(tenantConfig.tenantId, tenantId), eq(tenantConfig.key, key)));
  return row ? Number(row.value) : null;
}
