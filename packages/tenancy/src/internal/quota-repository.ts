import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { TenantId } from "@archiva/shared";
import { and, eq, gt, gte, lte, sql, sum } from "drizzle-orm";
import type { QuotaReservation } from "../service.ts";
import { RESERVATION_TTL_MS } from "./reservation-ttl.ts";

const { tenants, quotaReservations } = schema;

/**
 * Quota ledger queries for the tenancy data layer. Imported only by
 * `../repository.ts`, so all Drizzle access stays inside the repository
 * layer (CODING_STANDARD 4.4). Extracted to hold `repository.ts` under the
 * 250-line split threshold (CODING_STANDARD 5.1).
 */
export async function tryReserve(
  db: Db,
  tenantId: TenantId,
  bytes: number,
  now: Date,
): Promise<QuotaReservation | null> {
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
      .where(and(eq(quotaReservations.tenantId, tenantId), gt(quotaReservations.expiresAt, now)));
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
}

export async function commitReservation(db: Db, reservation: QuotaReservation): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(quotaReservations).where(eq(quotaReservations.id, reservation.id));
    await tx
      .update(tenants)
      .set({ storageUsedBytes: sql`${tenants.storageUsedBytes} + ${reservation.bytes}` })
      .where(eq(tenants.id, reservation.tenantId));
  });
}

export async function releaseReservation(db: Db, reservation: QuotaReservation): Promise<void> {
  await db.delete(quotaReservations).where(eq(quotaReservations.id, reservation.id));
}

export async function revertCommitReservation(
  db: Db,
  reservation: QuotaReservation,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Defensive: the commit already deleted the row, but a retry must not
    // double-debit, so remove any leftover before touching the counter.
    await tx.delete(quotaReservations).where(eq(quotaReservations.id, reservation.id));
    const [updated] = await tx
      .update(tenants)
      .set({ storageUsedBytes: sql`${tenants.storageUsedBytes} - ${reservation.bytes}` })
      .where(
        and(eq(tenants.id, reservation.tenantId), gte(tenants.storageUsedBytes, reservation.bytes)),
      )
      .returning({ id: tenants.id });
    if (!updated) {
      throw new Error(
        `revertCommitReservation: tenant ${reservation.tenantId} missing or used bytes below ${reservation.bytes}`,
      );
    }
  });
}

export async function sweepExpiredReservations(db: Db, now: Date): Promise<number> {
  const deleted = await db
    .delete(quotaReservations)
    .where(lte(quotaReservations.expiresAt, now))
    .returning({ id: quotaReservations.id });
  return deleted.length;
}

export async function usage(
  db: Db,
  tenantId: TenantId,
): Promise<{ usedBytes: number; quotaBytes: number }> {
  const [row] = await db
    .select({ usedBytes: tenants.storageUsedBytes, quotaBytes: tenants.storageQuotaBytes })
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  if (!row) throw new Error(`usage: tenant ${tenantId} not found`);
  return row;
}
