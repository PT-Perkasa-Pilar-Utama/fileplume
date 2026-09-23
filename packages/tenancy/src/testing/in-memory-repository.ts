import type { TenantId, UserId } from "@archiva/shared";
import { asTenantId, err, ok } from "@archiva/shared";
import type * as E from "../errors.ts";
import { DEFAULT_STORAGE_QUOTA_BYTES, type StoredConfigRow } from "../internal/config-specs.ts";
import { RESERVATION_TTL_MS } from "../internal/reservation-ttl.ts";
import type { TenancyRepository } from "../repository.ts";
import type {
  ConfigKey,
  ListTenantsSort,
  QuotaReservation,
  Tenant,
  TenantCreated,
  TenantListed,
} from "../service.ts";

/**
 * Ships with the module so every module is importable in a test with no
 * network, no container and no environment variables.
 * technical-specs/03-repository-structure.md 3.3.
 */
export function inMemoryTenancyRepository(
  initial: {
    quotaBytes?: number;
    usedBytes?: number;
    tenants?: Tenant[];
    allTenants?: TenantCreated[];
    users?: { id: string; name: string }[];
    config?: {
      tenantId: TenantId;
      key: ConfigKey;
      value: number;
      updatedBy?: { id: string; name: string };
    }[];
  } = {},
): TenancyRepository & { reservations: QuotaReservation[] } {
  const quotaBytes = initial.quotaBytes ?? DEFAULT_STORAGE_QUOTA_BYTES;
  const fallbackUsedBytes = initial.usedBytes ?? 0;
  let unscopedUsedBytes = fallbackUsedBytes;
  const resolveableTenants = [...(initial.tenants ?? [])];
  const allTenants: TenantCreated[] = initial.allTenants
    ? [...initial.allTenants]
    : (initial.tenants ?? []).map((t) => ({
        ...t,
        storageQuotaBytes: quotaBytes,
        storageUsedBytes: fallbackUsedBytes,
        createdAt: new Date(),
      }));
  const users = new Map((initial.users ?? []).map((u) => [u.id, u.name]));
  const config = new Map<string, StoredConfigRow>();
  const held: (QuotaReservation & { expiresAt: Date })[] = [];
  const key = (t: TenantId, k: ConfigKey) => `${t}:${k}`;

  for (const entry of initial.config ?? []) {
    config.set(key(entry.tenantId, entry.key), {
      key: entry.key,
      value: entry.value,
      updatedAt: new Date(),
      updatedBy: entry.updatedBy ?? null,
    });
  }

  return {
    get reservations(): QuotaReservation[] {
      return held.map(({ id, tenantId, bytes }) => ({ id, tenantId, bytes }));
    },

    async findTenantBySubdomain(subdomain) {
      const wanted = subdomain.toLowerCase();
      return resolveableTenants.find((t) => t.subdomain.toLowerCase() === wanted) ?? null;
    },

    async findConfigEntries(t) {
      const prefix = `${t}:`;
      const entries: StoredConfigRow[] = [];
      for (const [k, v] of config.entries()) {
        if (k.startsWith(prefix)) {
          entries.push(v);
        }
      }
      return entries;
    },

    async findConfigRow(t, k) {
      return config.get(key(t, k)) ?? null;
    },

    async findConfigValue(t, k) {
      return config.get(key(t, k))?.value ?? null;
    },

    async upsertConfigValue(t, k, value, actor: UserId) {
      const actorName = users.get(actor);
      config.set(key(t, k), {
        key: k,
        value,
        updatedAt: new Date(),
        updatedBy: actorName ? { id: actor, name: actorName } : null,
      });
    },

    async deleteConfigValue(t, k, _actor: UserId) {
      config.delete(key(t, k));
    },

    async tryReserve(tenantId, bytes, now) {
      const tenant = allTenants.find((t) => t.id === tenantId);
      const limit = tenant?.storageQuotaBytes ?? quotaBytes;
      const currentUsed = tenant?.storageUsedBytes ?? unscopedUsedBytes;
      const outstanding = held
        .filter((r) => r.tenantId === tenantId && r.expiresAt > now)
        .reduce((sum, r) => sum + r.bytes, 0);

      if (currentUsed + outstanding + bytes > limit) return null;

      const expiresAt = new Date(now.getTime() + RESERVATION_TTL_MS);
      const reservation = { id: crypto.randomUUID(), tenantId, bytes, expiresAt };
      held.push(reservation);
      return { id: reservation.id, tenantId, bytes };
    },

    async commitReservation(reservation) {
      const i = held.findIndex((r) => r.id === reservation.id);
      if (i >= 0) held.splice(i, 1);

      const tenant = allTenants.find((t) => t.id === reservation.tenantId);
      if (tenant) {
        tenant.storageUsedBytes += reservation.bytes;
      } else {
        unscopedUsedBytes += reservation.bytes;
      }
    },

    async releaseReservation(reservation) {
      const i = held.findIndex((r) => r.id === reservation.id);
      if (i >= 0) held.splice(i, 1);
    },

    async sweepExpiredReservations(now) {
      const before = held.length;
      const surviving = held.filter((r) => r.expiresAt > now);
      held.length = 0;
      held.push(...surviving);

      return before - surviving.length;
    },

    async usage(tenantId: TenantId) {
      const tenant = allTenants.find((t) => t.id === tenantId);
      if (tenant) {
        return { usedBytes: tenant.storageUsedBytes, quotaBytes: tenant.storageQuotaBytes };
      }
      return { usedBytes: unscopedUsedBytes, quotaBytes };
    },

    async createTenant(
      input: { name: string; subdomain: string; storageQuotaBytes: number },
      _actorId: UserId,
    ): Promise<
      | { ok: true; value: TenantCreated }
      | { ok: false; error: E.TenantNameTaken | E.SubdomainTaken }
    > {
      if (allTenants.some((t) => t.name === input.name)) {
        return err({ kind: "TenantNameTaken" });
      }
      if (allTenants.some((t) => t.subdomain.toLowerCase() === input.subdomain.toLowerCase())) {
        return err({ kind: "SubdomainTaken" });
      }
      const tenant: TenantCreated = {
        id: asTenantId(crypto.randomUUID()),
        name: input.name,
        subdomain: input.subdomain.toLowerCase(),
        status: "active",
        storageQuotaBytes: input.storageQuotaBytes,
        storageUsedBytes: 0,
        createdAt: new Date(),
      };
      allTenants.push(tenant);
      resolveableTenants.push(tenant);
      return ok(tenant);
    },

    async listTenants(filter: {
      q?: string;
      sort: ListTenantsSort;
      order: "asc" | "desc";
      page: number;
      limit: number;
    }): Promise<{ rows: TenantListed[]; total: number }> {
      let results = [...allTenants];

      if (filter.q) {
        const q = filter.q.toLowerCase();
        results = results.filter(
          (t) => t.name.toLowerCase().includes(q) || t.subdomain.toLowerCase().includes(q),
        );
      }

      results.sort((a, b) => {
        const mul = filter.order === "asc" ? 1 : -1;
        if (filter.sort === "name") return mul * a.name.localeCompare(b.name);
        if (filter.sort === "storageUsedBytes")
          return mul * (a.storageUsedBytes - b.storageUsedBytes);
        return mul * (a.createdAt.getTime() - b.createdAt.getTime());
      });

      const total = results.length;
      const offset = (filter.page - 1) * filter.limit;
      const rows: TenantListed[] = results
        .slice(offset, offset + filter.limit)
        .map((t) => ({ ...t, documentCount: 0, userCount: 0 }));

      return { rows, total };
    },
  };
}
