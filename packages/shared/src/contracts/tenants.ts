import { z } from "zod";
import { sortableQuery, timestampSchema } from "./common.ts";
import { TENANT_STATUSES } from "./enums.ts";

const storageQuotaGb = z.number().int().min(1).max(10000);

/** api-specs/03-tenants.md 3.1. DNS-safe, lowercased on write. */
export const createTenantBody = z.object({
  name: z.string().trim().min(1).max(200),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/),
  storageQuotaGb: storageQuotaGb.default(50),
});
export type CreateTenantBody = z.infer<typeof createTenantBody>;

/** 3.4. Byte counts are integers, never floats. */
export const tenantSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    subdomain: z.string(),
    status: z.enum(TENANT_STATUSES),
    storageQuotaBytes: z.number().int().nonnegative(),
    storageUsedBytes: z.number().int().nonnegative(),
    createdAt: timestampSchema,
  })
  .meta({ id: "Tenant" });
export type TenantView = z.infer<typeof tenantSchema>;

/** 3.2. Counts and quota figures only; no tenant content crosses into it. */
export const tenantListItemSchema = tenantSchema
  .extend({
    storagePercent: z.number().int().nonnegative(),
    documentCount: z.number().int().nonnegative(),
    userCount: z.number().int().nonnegative(),
  })
  .meta({ id: "TenantListItem" });
export type TenantListItem = z.infer<typeof tenantListItemSchema>;

export const listTenantsQuery = sortableQuery(
  ["createdAt", "name", "storageUsedBytes"],
  "createdAt",
  "desc",
).extend({ q: z.string().optional() });

export const tenantIdParams = z.object({ tenantId: z.uuid() });

/** 3.3. */
export const setQuotaBody = z.object({ storageQuotaGb });
