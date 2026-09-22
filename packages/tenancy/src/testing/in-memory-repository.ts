import type { TenantId, UserId } from "@archiva/shared";
import { asTenantId, err, ok } from "@archiva/shared";
import type * as E from "../errors.ts";
import type { TenancyRepository } from "../repository.ts";
import { RESERVATION_TTL_MS } from "../repository.ts";
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
        storageUsedBytes: initial.usedBytes ?? 0,
        createdAt: new Date(),
      }));
  const config = new Map<string, number>();
  const reservations: QuotaReservation[] = [];
  const activeReservations: (QuotaReservation & { expiresAt: Date })[] = [];
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

    async tryReserve(tenantId, bytes, now = new Date()) {
      const tenant = allTenants.find((t) => t.id === tenantId);
      const limit = tenant?.storageQuotaBytes ?? quotaBytes;
      const currentUsed = tenant?.storageUsedBytes ?? usedBytes;
      const outstanding = activeReservations
        .filter((r) => r.tenantId === tenantId && r.expiresAt > now)
        .reduce((sum, r) => sum + r.bytes, 0);

      if (currentUsed + outstanding + bytes > limit) return null;

      const expiresAt = new Date(now.getTime() + RESERVATION_TTL_MS);
      const reservation = { id: crypto.randomUUID(), tenantId, bytes, expiresAt };
      activeReservations.push(reservation);
      reservations.push({ id: reservation.id, tenantId, bytes });
      return { id: reservation.id, tenantId, bytes };
    },

    async commitReservation(reservation) {
      const i = activeReservations.findIndex((r) => r.id === reservation.id);
      if (i >= 0) activeReservations.splice(i, 1);
      const j = reservations.findIndex((r) => r.id === reservation.id);
      if (j >= 0) reservations.splice(j, 1);

      const tenant = allTenants.find((t) => t.id === reservation.tenantId);
      if (tenant) {
        tenant.storageUsedBytes += reservation.bytes;
      } else {
        usedBytes += reservation.bytes;
      }
    },

    async releaseReservation(reservation) {
      const i = activeReservations.findIndex((r) => r.id === reservation.id);
      if (i >= 0) activeReservations.splice(i, 1);
      const j = reservations.findIndex((r) => r.id === reservation.id);
      if (j >= 0) reservations.splice(j, 1);
    },

    async sweepExpiredReservations(now = new Date()) {
      const expired = activeReservations.filter((r) => r.expiresAt <= now);
      if (expired.length === 0) return 0;
      const expiredIds = new Set(expired.map((r) => r.id));

      const active = activeReservations.filter((r) => !expiredIds.has(r.id));
      activeReservations.length = 0;
      activeReservations.push(...active);

      const surviving = reservations.filter((r) => !expiredIds.has(r.id));
      reservations.length = 0;
      reservations.push(...surviving);

      return expiredIds.size;
    },

    async usage(tenantId: TenantId) {
      const tenant = allTenants.find((t) => t.id === tenantId);
      if (tenant) {
        return { usedBytes: tenant.storageUsedBytes, quotaBytes: tenant.storageQuotaBytes };
      }
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
