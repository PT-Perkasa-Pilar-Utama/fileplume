import type { TenantId, UserId } from "@archiva/shared";
import type { TenancyRepository } from "../repository.ts";
import type { ConfigKey, QuotaReservation } from "../service.ts";

/**
 * Ships with the module so every module is importable in a test with no
 * network, no container and no environment variables.
 * technical-specs/03-repository-structure.md 3.3.
 */
export function inMemoryTenancyRepository(
  initial: { quotaBytes?: number; usedBytes?: number } = {},
): TenancyRepository & { reservations: QuotaReservation[] } {
  const config = new Map<string, number>();
  const reservations: QuotaReservation[] = [];
  let usedBytes = initial.usedBytes ?? 0;
  const quotaBytes = initial.quotaBytes ?? 53_687_091_200;
  const key = (t: TenantId, k: ConfigKey) => `${t}:${k}`;

  return {
    reservations,
    async findConfigValue(t, k) {
      return config.get(key(t, k)) ?? null;
    },
    async upsertConfigValue(t, k, value, _actor: UserId) {
      config.set(key(t, k), value);
    },
    async deleteConfigValue(t, k, _actor: UserId) {
      config.delete(key(t, k));
    },
    async tryReserve(tenantId, bytes) {
      const outstanding = reservations.reduce((sum, r) => sum + r.bytes, 0);
      if (usedBytes + outstanding + bytes > quotaBytes) return null;
      const reservation = { id: crypto.randomUUID(), tenantId, bytes };
      reservations.push(reservation);
      return reservation;
    },
    async commitReservation(reservation) {
      const i = reservations.findIndex((r) => r.id === reservation.id);
      if (i >= 0) reservations.splice(i, 1);
      usedBytes += reservation.bytes;
    },
    async releaseReservation(reservation) {
      const i = reservations.findIndex((r) => r.id === reservation.id);
      if (i >= 0) reservations.splice(i, 1);
    },
    async usage() {
      return { usedBytes, quotaBytes };
    },
  };
}
