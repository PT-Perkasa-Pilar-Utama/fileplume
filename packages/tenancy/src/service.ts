import type {
  ConfigKeyName,
  Result,
  StorageLevel,
  StorageView,
  TenantId,
  TenantListItem,
  TenantStatus,
  TenantView,
  UserId,
} from "@archiva/shared";
import {
  err,
  ok,
  STORAGE_FULL_MESSAGE,
  STORAGE_FULL_THRESHOLD_PERCENT,
  STORAGE_WARNING_MESSAGE,
  STORAGE_WARNING_THRESHOLD_PERCENT,
} from "@archiva/shared";
import type * as E from "./errors.ts";
import type { Clock } from "./ports.ts";
import type { TenancyRepository } from "./repository.ts";

/** technical-specs/06-data-model.md 6.3. Declared once, in @archiva/shared. */
export type { TenantStatus };

type ConfigKeySpec = {
  default: number;
  min: number;
  max: number;
  unit: string;
  tenantEditable: boolean;
};

/** technical-specs/06-data-model.md 6.3. Keyed by the shared closed union, so a missing key fails to compile. */
export const CONFIG_KEYS = {
  max_file_size_mb: { default: 20, min: 1, max: 200, unit: "MB", tenantEditable: true },
  pending_confirmation_days: { default: 7, min: 1, max: 90, unit: "hari", tenantEditable: true },
  storage_quota_gb: { default: 50, min: 1, max: 10000, unit: "GB", tenantEditable: false },
} as const satisfies Record<ConfigKeyName, ConfigKeySpec>;

export type ConfigKey = keyof typeof CONFIG_KEYS;
export type QuotaReservation = { id: string; tenantId: TenantId; bytes: number };
export type Tenant = { id: TenantId; name: string; subdomain: string; status: TenantStatus };

/** Raw row returned by the repository after a tenant insert. */
export type TenantCreated = {
  id: TenantId;
  name: string;
  subdomain: string;
  status: TenantStatus;
  storageQuotaBytes: number;
  storageUsedBytes: number;
  createdAt: Date;
};

/** Raw row returned by the repository for tenant list queries. */
export type TenantListed = TenantCreated & {
  documentCount: number;
  userCount: number;
};

export type ListTenantsSort = "createdAt" | "name" | "storageUsedBytes";

export interface TenancyService {
  /** Step 1 of api-specs/01-conventions.md 1.12. Subdomains are citext, so case never matters. */
  resolveTenant(subdomain: string): Promise<Tenant | null>;
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
  sweepExpiredReservations(): Promise<number>;
  getQuotaUsage(tenantId: TenantId): Promise<StorageView>;
  /** AC-43.01. Provisions the Uncategorized system category inside the same transaction. */
  createTenant(
    input: { name: string; subdomain: string; storageQuotaGb: number },
    actorId: UserId,
  ): Promise<Result<TenantView, E.TenantNameTaken | E.SubdomainTaken>>;
  listTenants(filter: {
    q?: string;
    sort: ListTenantsSort;
    order: "asc" | "desc";
    page: number;
    limit: number;
  }): Promise<{ rows: TenantListItem[]; total: number }>;
}

export function createTenancyService(deps: {
  repository: TenancyRepository;
  clock: Clock;
}): TenancyService {
  const { repository, clock } = deps;

  return {
    resolveTenant: (subdomain) => repository.findTenantBySubdomain(subdomain),

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
      const reservation = await repository.tryReserve(tenantId, bytes, clock.now());
      return reservation ? ok(reservation) : err({ kind: "QuotaExceeded" });
    },

    commitQuota: (r) => repository.commitReservation(r),
    releaseQuota: (r) => repository.releaseReservation(r),
    // SCAFFOLD: the interval that calls this lands with the worker in BE-S3-01.
    // Until then expiry is honoured by tryReserve, but the rows are not removed.
    // api-specs/04-configuration.md 4.6.
    sweepExpiredReservations: () => repository.sweepExpiredReservations(clock.now()),

    async getQuotaUsage(tenantId) {
      const { usedBytes, quotaBytes } = await repository.usage(tenantId);
      // No quota is full, not empty: the indicator must not disagree with the
      // upload refusal. api-specs/04-configuration.md 4.5.
      const percent =
        quotaBytes <= 0
          ? usedBytes > 0
            ? STORAGE_FULL_THRESHOLD_PERCENT
            : 0
          : Math.floor((usedBytes / quotaBytes) * 100);
      let level: StorageLevel = "ok";
      let message: string | null = null;
      if (percent >= STORAGE_FULL_THRESHOLD_PERCENT) {
        level = "full";
        message = STORAGE_FULL_MESSAGE;
      } else if (percent >= STORAGE_WARNING_THRESHOLD_PERCENT) {
        level = "warning";
        message = STORAGE_WARNING_MESSAGE;
      }
      return { usedBytes, quotaBytes, percent, level, message };
    },

    async createTenant(input, actorId) {
      const storageQuotaBytes = input.storageQuotaGb * 1024 ** 3;
      const result = await repository.createTenant(
        { name: input.name, subdomain: input.subdomain, storageQuotaBytes },
        actorId,
      );
      if (!result.ok) return result;
      const t = result.value;
      return ok({
        id: t.id,
        name: t.name,
        subdomain: t.subdomain,
        status: t.status,
        storageQuotaBytes: t.storageQuotaBytes,
        storageUsedBytes: t.storageUsedBytes,
        createdAt: t.createdAt.toISOString(),
      });
    },

    async listTenants(filter) {
      const { rows, total } = await repository.listTenants(filter);
      return {
        total,
        rows: rows.map((t) => ({
          id: t.id,
          name: t.name,
          subdomain: t.subdomain,
          status: t.status,
          storageQuotaBytes: t.storageQuotaBytes,
          storageUsedBytes: t.storageUsedBytes,
          createdAt: t.createdAt.toISOString(),
          storagePercent:
            t.storageQuotaBytes === 0
              ? 0
              : Math.floor((t.storageUsedBytes / t.storageQuotaBytes) * 100),
          documentCount: t.documentCount,
          userCount: t.userCount,
        })),
      };
    },
  };
}
