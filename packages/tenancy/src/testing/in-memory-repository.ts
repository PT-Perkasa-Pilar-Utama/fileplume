import type { TenantId, UserId } from "@archiva/shared";
import { asTenantId, err, ok } from "@archiva/shared";
import type * as E from "../errors.ts";
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
  } = {},
): TenancyRepository & { reservations: QuotaReservation[] } {
  const quotaBytes = initial.quotaBytes ?? 53_687_091_200;
  let usedBytes = initial.usedBytes ?? 0;
  const resolveableTenants = [...(initial.tenants ?? [])];
  const allTenants: TenantCreated[] = initial.allTenants
    ? [...initial.allTenants]
    : (initial.tenants ?? []).map((t) => ({
        ...t,
        storageQuotaBytes: quotaBytes,
        storageUsedBytes: 0,
        createdAt: new Date(),
      }));
  const config = new Map<string, number>();
  const reservations: QuotaReservation[] = [];
  const key = (t: TenantId, k: ConfigKey) => `${t}:${k}`;

  return {
    reservations,

    async findTenantBySubdomain(subdomain) {
      const wanted = subdomain.toLowerCase();
      return resolveableTenants.find((t) => t.subdomain.toLowerCase() === wanted) ?? null;
    },

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
