import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { Result, TenantId, UserId } from "@archiva/shared";
import { asTenantId, err, ok } from "@archiva/shared";
import { and, asc, count, desc, eq, gt, ilike, lte, or, sql, sum } from "drizzle-orm";
import type * as E from "./errors.ts";
import { isUniqueViolationOn } from "./internal/unique-violation.ts";
import type {
  ConfigKey,
  ListTenantsSort,
  QuotaReservation,
  Tenant,
  TenantCreated,
  TenantListed,
} from "./service.ts";

/** Drizzle queries scoped to this module's own tables. */
export interface TenancyRepository {
  findTenantBySubdomain(subdomain: string): Promise<Tenant | null>;
  findConfigValue(tenantId: TenantId, key: ConfigKey): Promise<number | null>;
  upsertConfigValue(t: TenantId, key: ConfigKey, value: number, actor: UserId): Promise<void>;
  deleteConfigValue(t: TenantId, key: ConfigKey, actor: UserId): Promise<void>;
  tryReserve(tenantId: TenantId, bytes: number, now?: Date): Promise<QuotaReservation | null>;
  commitReservation(reservation: QuotaReservation): Promise<void>;
  releaseReservation(reservation: QuotaReservation): Promise<void>;
  sweepExpiredReservations(now?: Date): Promise<number>;
  usage(tenantId: TenantId): Promise<{ usedBytes: number; quotaBytes: number }>;
  /** AC-43.01. Inserts tenant + Uncategorized system category in one transaction. */
  createTenant(
    input: { name: string; subdomain: string; storageQuotaBytes: number },
    actorId: UserId,
  ): Promise<Result<TenantCreated, E.TenantNameTaken | E.SubdomainTaken>>;
  listTenants(filter: {
    q?: string;
    sort: ListTenantsSort;
    order: "asc" | "desc";
    page: number;
    limit: number;
  }): Promise<{ rows: TenantListed[]; total: number }>;
}

const { tenants, tenantConfig, quotaReservations, categories, categoryPermissions } = schema;

/** api-specs/04-configuration.md 4.6. An abandoned upload returns its capacity. */
export const RESERVATION_TTL_MS = 15 * 60 * 1000;

/**
 * The worked example for every module that follows: Drizzle queries live
 * here and nowhere else, satisfying the same interface the in-memory test
 * double does. technical-specs/06-data-model.md 6.3.
 *
 * `tryReserve` is the one invariant worth a comment: capacity is reserved
 * under a row lock on the tenant, never read-then-checked, so two concurrent
 * reservations that together exceed quota cannot both succeed (CLAUDE.md
 * concurrency law 14, AC-35.04).
 */
export function createDrizzleTenancyRepository(db: Db): TenancyRepository {
  return {
    async findTenantBySubdomain(subdomain) {
      const [row] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          subdomain: tenants.subdomain,
          status: tenants.status,
        })
        .from(tenants)
        .where(eq(tenants.subdomain, subdomain));
      return row ? { ...row, id: asTenantId(row.id) } : null;
    },

    async findConfigValue(tenantId, key) {
      const [row] = await db
        .select({ value: tenantConfig.value })
        .from(tenantConfig)
        .where(and(eq(tenantConfig.tenantId, tenantId), eq(tenantConfig.key, key)));
      return row ? Number(row.value) : null;
    },

    async upsertConfigValue(tenantId, key, value, actor) {
      await db
        .insert(tenantConfig)
        .values({ tenantId, key, value: String(value), updatedBy: actor })
        .onConflictDoUpdate({
          target: [tenantConfig.tenantId, tenantConfig.key],
          set: { value: String(value), updatedBy: actor, updatedAt: new Date() },
        });
    },

    async deleteConfigValue(tenantId, key, _actor) {
      await db
        .delete(tenantConfig)
        .where(and(eq(tenantConfig.tenantId, tenantId), eq(tenantConfig.key, key)));
    },

    async tryReserve(tenantId, bytes, now = new Date()) {
      return db.transaction(async (tx) => {
        const [tenant] = await tx
          .select({ usedBytes: tenants.storageUsedBytes, quotaBytes: tenants.storageQuotaBytes })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .for("update");
        if (!tenant) return null;

        const [outstanding] = await tx
          .select({ total: sum(quotaReservations.bytes) })
          .from(quotaReservations)
          .where(
            and(eq(quotaReservations.tenantId, tenantId), gt(quotaReservations.expiresAt, now)),
          );
        const outstandingBytes = Number(outstanding?.total ?? 0);

        if (tenant.usedBytes + outstandingBytes + bytes > tenant.quotaBytes) return null;

        const [inserted] = await tx
          .insert(quotaReservations)
          .values({
            tenantId,
            bytes,
            expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS),
          })
          .returning({ id: quotaReservations.id });
        if (!inserted) return null;

        return { id: inserted.id, tenantId, bytes };
      });
    },

    async commitReservation(reservation) {
      await db.transaction(async (tx) => {
        await tx.delete(quotaReservations).where(eq(quotaReservations.id, reservation.id));
        await tx
          .update(tenants)
          .set({ storageUsedBytes: sql`${tenants.storageUsedBytes} + ${reservation.bytes}` })
          .where(eq(tenants.id, reservation.tenantId));
      });
    },

    async releaseReservation(reservation) {
      await db.delete(quotaReservations).where(eq(quotaReservations.id, reservation.id));
    },

    async sweepExpiredReservations(now = new Date()) {
      const deleted = await db
        .delete(quotaReservations)
        .where(lte(quotaReservations.expiresAt, now))
        .returning({ id: quotaReservations.id });
      return deleted.length;
    },

    async usage(tenantId) {
      const [row] = await db
        .select({ usedBytes: tenants.storageUsedBytes, quotaBytes: tenants.storageQuotaBytes })
        .from(tenants)
        .where(eq(tenants.id, tenantId));
      if (!row) throw new Error(`usage: tenant ${tenantId} not found`);
      return row;
    },

    async createTenant(input, actorId) {
      try {
        return await db.transaction(async (tx) => {
          const [tenant] = await tx
            .insert(tenants)
            .values({
              name: input.name,
              subdomain: input.subdomain,
              storageQuotaBytes: input.storageQuotaBytes,
            })
            .returning({
              id: tenants.id,
              name: tenants.name,
              subdomain: tenants.subdomain,
              status: tenants.status,
              storageQuotaBytes: tenants.storageQuotaBytes,
              storageUsedBytes: tenants.storageUsedBytes,
              createdAt: tenants.createdAt,
            });
          if (!tenant) throw new Error("createTenant: insert returned no row");

          // Seed reserved Uncategorized category. AC-06.03, AC-45.01.
          const [category] = await tx
            .insert(categories)
            .values({
              tenantId: tenant.id,
              name: "Uncategorized",
              isSystem: true,
              createdBy: actorId,
            })
            .returning({ id: categories.id });
          if (!category) throw new Error("createTenant: category insert returned no row");

          await tx.insert(categoryPermissions).values({
            categoryId: category.id,
            tenantId: tenant.id,
            downloadActive: false,
            updatedBy: actorId,
          });

          return ok({ ...tenant, id: asTenantId(tenant.id) });
        });
      } catch (caughtErr) {
        if (isUniqueViolationOn(caughtErr, "tenants_name_unique")) {
          return err({ kind: "TenantNameTaken" });
        }
        if (isUniqueViolationOn(caughtErr, "tenants_subdomain_unique")) {
          return err({ kind: "SubdomainTaken" });
        }
        throw caughtErr;
      }
    },

    async listTenants(filter) {
      const sortCol = {
        createdAt: tenants.createdAt,
        name: tenants.name,
        storageUsedBytes: tenants.storageUsedBytes,
      }[filter.sort];
      const direction = filter.order === "asc" ? asc(sortCol) : desc(sortCol);
      const where = filter.q
        ? or(ilike(tenants.name, `%${filter.q}%`), ilike(tenants.subdomain, `%${filter.q}%`))
        : undefined;

      const [countRow] = await db.select({ total: count() }).from(tenants).where(where);
      const total = countRow?.total ?? 0;

      const rows = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          subdomain: tenants.subdomain,
          status: tenants.status,
          storageQuotaBytes: tenants.storageQuotaBytes,
          storageUsedBytes: tenants.storageUsedBytes,
          createdAt: tenants.createdAt,
          documentCount: sql<number>`(SELECT count(*)::int FROM documents WHERE documents.tenant_id = tenants.id AND documents.deleted_at IS NULL)`,
          userCount: sql<number>`(SELECT count(*)::int FROM users WHERE users.tenant_id = tenants.id)`,
        })
        .from(tenants)
        .where(where)
        .orderBy(direction)
        .limit(filter.limit)
        .offset((filter.page - 1) * filter.limit);

      return {
        total,
        rows: rows.map((row) => ({ ...row, id: asTenantId(row.id) })),
      };
    },
  };
}
