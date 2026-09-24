import type {
  ConfigParameter,
  Result,
  SetConfigValueBody,
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
import {
  BYTES_PER_GB,
  buildConfigParameters,
  CONFIG_KEY_LABELS,
  CONFIG_KEYS,
  type ConfigKey,
} from "./internal/config-specs.ts";
import type { Clock } from "./ports.ts";
import type { TenancyRepository } from "./repository.ts";

/** technical-specs/06-data-model.md 6.3. Declared once, in @archiva/shared. */
export type { TenantStatus };
export { CONFIG_KEYS, type ConfigKey };

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
  getConfiguration(tenantId: TenantId): Promise<ConfigParameter[]>;
  getConfigValue(tenantId: TenantId, key: ConfigKey): Promise<number>;
  setConfigValue(
    tenantId: TenantId,
    key: ConfigKey,
    value: SetConfigValueBody["value"],
    actor: UserId,
  ): Promise<
    Result<
      { parameter: ConfigParameter; previousValue: number },
      E.InvalidConfigValue | E.ValueOutOfRange | E.NotEditableByTenant
    >
  >;
  resetConfigValue(
    tenantId: TenantId,
    key: ConfigKey,
    actor: UserId,
  ): Promise<Result<ConfigParameter, E.NotEditableByTenant>>;
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
  /**
   * Inverse of `commitQuota`, for the batch rollback only. Each reservation
   * commits as soon as its file lands, so a later session expiry debits
   * committed bytes back instead of releasing a consumed reservation.
   * At most once per committed reservation. AC-01.08, AC-35.04.
   */
  revertCommit(reservation: QuotaReservation): Promise<void>;
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

  async function getConfigValue(tenantId: TenantId, key: ConfigKey): Promise<number> {
    const stored = await repository.findConfigValue(tenantId, key);
    return stored ?? CONFIG_KEYS[key].default;
  }

  return {
    resolveTenant: (subdomain) => repository.findTenantBySubdomain(subdomain),

    async getConfiguration(tenantId) {
      // A missing tenant row is programmer error: every route resolves the
      // tenant from the subdomain before reaching this service. Propagate so
      // a miswired caller fails loudly instead of serving a plausible table.
      const usage = await repository.usage(tenantId);
      const entries = await repository.findConfigEntries(tenantId);
      return buildConfigParameters(entries, usage.quotaBytes);
    },

    getConfigValue: (tenantId, key) => getConfigValue(tenantId, key),

    async setConfigValue(tenantId, key, value, actor) {
      const spec = CONFIG_KEYS[key];
      if (!spec.tenantEditable) return err({ kind: "NotEditableByTenant", key });
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return err({ kind: "InvalidConfigValue", key });
      }
      if (value < spec.min || value > spec.max) {
        return err({ kind: "ValueOutOfRange", key, min: spec.min, max: spec.max, unit: spec.unit });
      }

      const previousValue = await getConfigValue(tenantId, key);
      await repository.upsertConfigValue(tenantId, key, value, actor);
      const updatedEntry = await repository.findConfigRow(tenantId, key);
      if (!updatedEntry) {
        throw new Error(`setConfigValue: ${key} missing after upsert for tenant ${tenantId}`);
      }

      const parameter: ConfigParameter = {
        key,
        label: CONFIG_KEY_LABELS[key],
        value,
        defaultValue: spec.default,
        unit: spec.unit,
        min: spec.min,
        max: spec.max,
        editable: spec.tenantEditable,
        isDefault: false,
        updatedAt: updatedEntry.updatedAt.toISOString(),
        updatedBy: updatedEntry.updatedBy,
      };

      return ok({ parameter, previousValue });
    },

    async resetConfigValue(tenantId, key, actor) {
      const spec = CONFIG_KEYS[key];
      if (!spec.tenantEditable) return err({ kind: "NotEditableByTenant", key });
      await repository.deleteConfigValue(tenantId, key, actor);

      const parameter: ConfigParameter = {
        key,
        label: CONFIG_KEY_LABELS[key],
        value: spec.default,
        defaultValue: spec.default,
        unit: spec.unit,
        min: spec.min,
        max: spec.max,
        editable: spec.tenantEditable,
        isDefault: true,
        updatedAt: null,
        updatedBy: null,
      };

      return ok(parameter);
    },

    async reserveQuota(tenantId, bytes) {
      const reservation = await repository.tryReserve(tenantId, bytes, clock.now());
      return reservation ? ok(reservation) : err({ kind: "QuotaExceeded" });
    },

    commitQuota: (r) => repository.commitReservation(r),
    releaseQuota: (r) => repository.releaseReservation(r),
    revertCommit: (r) => repository.revertCommitReservation(r),
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
      const storageQuotaBytes = input.storageQuotaGb * BYTES_PER_GB;
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
