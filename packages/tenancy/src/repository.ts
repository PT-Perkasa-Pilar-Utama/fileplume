import type { TenantId, UserId } from "@archiva/shared";
import type { ConfigKey, QuotaReservation } from "./service.ts";

/** Drizzle queries scoped to this module's own tables. Implemented in TL-S0-02. */
export interface TenancyRepository {
  findConfigValue(tenantId: TenantId, key: ConfigKey): Promise<number | null>;
  upsertConfigValue(t: TenantId, key: ConfigKey, value: number, actor: UserId): Promise<void>;
  deleteConfigValue(t: TenantId, key: ConfigKey, actor: UserId): Promise<void>;
  tryReserve(tenantId: TenantId, bytes: number): Promise<QuotaReservation | null>;
  commitReservation(reservation: QuotaReservation): Promise<void>;
  releaseReservation(reservation: QuotaReservation): Promise<void>;
  usage(tenantId: TenantId): Promise<{ usedBytes: number; quotaBytes: number }>;
}
