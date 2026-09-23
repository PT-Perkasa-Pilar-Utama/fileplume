import type { QuotaPort, QuotaReservationToken } from "@archiva/catalog";
import type { Result, TenantId } from "@archiva/shared";
import type { TenancyService } from "@archiva/tenancy";

export function createTenancyQuotaAdapter(tenancy: TenancyService): QuotaPort {
  return {
    async getMaxFileSizeMb(tenantId: TenantId): Promise<number> {
      return await tenancy.getConfigValue(tenantId, "max_file_size_mb");
    },

    async reserveQuota(
      tenantId: TenantId,
      bytes: number,
    ): Promise<Result<QuotaReservationToken, { kind: "QuotaExceeded" }>> {
      return await tenancy.reserveQuota(tenantId, bytes);
    },

    async commitQuota(reservation: QuotaReservationToken): Promise<void> {
      await tenancy.commitQuota(reservation);
    },

    async releaseQuota(reservation: QuotaReservationToken): Promise<void> {
      await tenancy.releaseQuota(reservation);
    },
  };
}
