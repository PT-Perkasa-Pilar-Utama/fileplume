import type { Result, TenantId, UserId } from "@archiva/shared";
import { err, ok } from "@archiva/shared";
import type * as E from "./errors.ts";
import type { Clock } from "./ports.ts";
import type { TenancyRepository } from "./repository.ts";

/** technical-specs/06-data-model.md 6.3. */
export type TenantStatus = "active" | "suspended";

/** technical-specs/06-data-model.md 6.3. A closed union, never a free string. */
export const CONFIG_KEYS = {
  max_file_size_mb: { default: 20, min: 1, max: 200, unit: "MB", tenantEditable: true },
  pending_confirmation_days: { default: 7, min: 1, max: 90, unit: "hari", tenantEditable: true },
  storage_quota_gb: { default: 50, min: 1, max: 10000, unit: "GB", tenantEditable: false },
} as const;

export type ConfigKey = keyof typeof CONFIG_KEYS;

export type QuotaReservation = { id: string; tenantId: TenantId; bytes: number };

export interface TenancyService {
  getConfigValue(tenantId: TenantId, key: ConfigKey): Promise<number>;
  setConfigValue(
    tenantId: TenantId,
    key: ConfigKey,
    value: number,
    actor: UserId,
  ): Promise<Result<void, E.InvalidConfigValue | E.ValueOutOfRange | E.NotEditableByTenant>>;
  resetConfigValue(
    tenantId: TenantId,
    key: ConfigKey,
    actor: UserId,
  ): Promise<Result<void, E.NotEditableByTenant>>;
  /**
   * The only correct way to check quota. Reading usage and then deciding is a
   * race, and AC-35.04 tests exactly that race.
   */
  reserveQuota(
    tenantId: TenantId,
    bytes: number,
  ): Promise<Result<QuotaReservation, E.QuotaExceeded>>;
  commitQuota(reservation: QuotaReservation): Promise<void>;
  releaseQuota(reservation: QuotaReservation): Promise<void>;
}

export function createTenancyService(deps: {
  repository: TenancyRepository;
  clock: Clock;
}): TenancyService {
  const { repository } = deps;

  return {
    async getConfigValue(tenantId, key) {
      const stored = await repository.findConfigValue(tenantId, key);
      return stored ?? CONFIG_KEYS[key].default;
    },

    async setConfigValue(tenantId, key, value, actor) {
      const spec = CONFIG_KEYS[key];
      if (!spec.tenantEditable) return err({ kind: "NotEditableByTenant", key });
      if (!Number.isInteger(value)) return err({ kind: "InvalidConfigValue", key });
      if (value < spec.min || value > spec.max) {
        return err({ kind: "ValueOutOfRange", key, min: spec.min, max: spec.max });
      }
      await repository.upsertConfigValue(tenantId, key, value, actor);
      return ok(undefined);
    },

    async resetConfigValue(tenantId, key, actor) {
      if (!CONFIG_KEYS[key].tenantEditable) return err({ kind: "NotEditableByTenant", key });
      await repository.deleteConfigValue(tenantId, key, actor);
      return ok(undefined);
    },

    async reserveQuota(tenantId, bytes) {
      const reservation = await repository.tryReserve(tenantId, bytes);
      return reservation ? ok(reservation) : err({ kind: "QuotaExceeded" });
    },

    commitQuota: (r) => repository.commitReservation(r),
    releaseQuota: (r) => repository.releaseReservation(r),
  };
}
