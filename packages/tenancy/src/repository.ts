import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { Result, TenantId, UserId } from "@archiva/shared";
import { asTenantId, err, ok } from "@archiva/shared";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import type * as E from "./errors.ts";
import { findConfigEntries, findConfigRow, findConfigValue } from "./internal/config-repository.ts";
import type { ConfigKey, StoredConfigRow } from "./internal/config-specs.ts";
import * as quotaLedger from "./internal/quota-repository.ts";
import { isUniqueViolationOn } from "./internal/unique-violation.ts";
import type {
  ListTenantsSort,
  QuotaReservation,
  Tenant,
  TenantCreated,
  TenantListed,
} from "./service.ts";

/** Drizzle queries scoped to this module's own tables. */
export interface TenancyRepository {
  findTenantBySubdomain(subdomain: string): Promise<Tenant | null>;
  findConfigEntries(tenantId: TenantId): Promise<StoredConfigRow[]>;
  findConfigRow(tenantId: TenantId, key: ConfigKey): Promise<StoredConfigRow | null>;
  findConfigValue(tenantId: TenantId, key: ConfigKey): Promise<number | null>;
  upsertConfigValue(t: TenantId, key: ConfigKey, value: number, actor: UserId): Promise<void>;
  deleteConfigValue(t: TenantId, key: ConfigKey, actor: UserId): Promise<void>;
  tryReserve(tenantId: TenantId, bytes: number, now: Date): Promise<QuotaReservation | null>;
  commitReservation(reservation: QuotaReservation): Promise<void>;
  releaseReservation(reservation: QuotaReservation): Promise<void>;
  /**
   * Inverse of a commit, for the batch rollback only. Each reservation commits
   * as soon as its file lands, so a later session expiry must debit committed
   * bytes back rather than release an already-consumed reservation.
   * Call at most once per committed reservation. A second call is refused by
   * the underflow guard below and throws; the batch rollback logs that throw
   * rather than masking its own outcome. AC-01.08, AC-35.04.
   */
  revertCommitReservation(reservation: QuotaReservation): Promise<void>;
  /** Global janitor across tenants, exempt from 8.3. Tenant reads use tryReserve. */
  sweepExpiredReservations(now: Date): Promise<number>;
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

const { tenants, tenantConfig, categories, categoryPermissions } = schema;

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

    async findConfigEntries(tenantId) {
      return findConfigEntries(db, tenantId);
    },

    async findConfigRow(tenantId, key) {
      return findConfigRow(db, tenantId, key);
    },

    async findConfigValue(tenantId, key) {
      return findConfigValue(db, tenantId, key);
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

    async tryReserve(tenantId, bytes, now) {
      return quotaLedger.tryReserve(db, tenantId, bytes, now);
    },

    async commitReservation(reservation) {
      await quotaLedger.commitReservation(db, reservation);
    },

    async releaseReservation(reservation) {
      await quotaLedger.releaseReservation(db, reservation);
    },

    async revertCommitReservation(reservation) {
      await quotaLedger.revertCommitReservation(db, reservation);
    },

    async sweepExpiredReservations(now) {
      return quotaLedger.sweepExpiredReservations(db, now);
    },

    async usage(tenantId) {
      return quotaLedger.usage(db, tenantId);
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
