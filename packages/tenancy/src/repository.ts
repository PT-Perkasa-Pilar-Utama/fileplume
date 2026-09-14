import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { TenantId, UserId } from "@archiva/shared";
import { and, eq, gt, sql, sum } from "drizzle-orm";
import type { ConfigKey, QuotaReservation } from "./service.ts";

/** Drizzle queries scoped to this module's own tables. */
export interface TenancyRepository {
  findConfigValue(tenantId: TenantId, key: ConfigKey): Promise<number | null>;
  upsertConfigValue(t: TenantId, key: ConfigKey, value: number, actor: UserId): Promise<void>;
  deleteConfigValue(t: TenantId, key: ConfigKey, actor: UserId): Promise<void>;
  tryReserve(tenantId: TenantId, bytes: number): Promise<QuotaReservation | null>;
  commitReservation(reservation: QuotaReservation): Promise<void>;
  releaseReservation(reservation: QuotaReservation): Promise<void>;
  usage(tenantId: TenantId): Promise<{ usedBytes: number; quotaBytes: number }>;
}

const { tenants, tenantConfig, quotaReservations } = schema;

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

    async tryReserve(tenantId, bytes) {
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
            and(
              eq(quotaReservations.tenantId, tenantId),
              gt(quotaReservations.expiresAt, new Date()),
            ),
          );
        const outstandingBytes = Number(outstanding?.total ?? 0);

        if (tenant.usedBytes + outstandingBytes + bytes > tenant.quotaBytes) return null;

        const [inserted] = await tx
          .insert(quotaReservations)
          .values({ tenantId, bytes })
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

    async usage(tenantId) {
      const [row] = await db
        .select({ usedBytes: tenants.storageUsedBytes, quotaBytes: tenants.storageQuotaBytes })
        .from(tenants)
        .where(eq(tenants.id, tenantId));
      if (!row) throw new Error(`usage: tenant ${tenantId} not found`);
      return row;
    },
  };
}
