import { AppError, one } from "@archiva/shared";
import type { TenancyService } from "@archiva/tenancy";
import { getStorage } from "./definitions/configuration.ts";
import { createRouter } from "./router.ts";

/** api-specs/04-configuration.md 4.5. Card BE-S2-02. */
export function storageRoutes(
  tenancy: Pick<TenancyService, "getQuotaUsage">,
): ReturnType<typeof createRouter> {
  return createRouter().openapi(getStorage, async (c) => {
    const tenant = c.get("tenant");
    if (!tenant) {
      throw new AppError("NOT_FOUND");
    }
    const usage = await tenancy.getQuotaUsage(tenant.id);
    return c.json(one(usage), 200);
  });
}
