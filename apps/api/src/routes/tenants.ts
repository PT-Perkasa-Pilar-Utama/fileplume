import { AppError, one, page } from "@archiva/shared";
import type { TenancyService } from "@archiva/tenancy";
import { createTenant, listTenants, setTenantQuota } from "./definitions/tenants.ts";
import { MOCK_TENANT_ROW } from "./mocks.ts";
import { createRouter } from "./router.ts";

/** api-specs/03-tenants.md. Served on the reserved admin subdomain. Card BE-S1-01. */
export function createTenantRoutes(tenancy: Pick<TenancyService, "createTenant" | "listTenants">) {
  return (
    createRouter()
      // 3.1
      .openapi(createTenant, async (c) => {
        const principal = c.get("principal");
        const body = c.req.valid("json");
        const result = await tenancy.createTenant(
          { name: body.name, subdomain: body.subdomain, storageQuotaGb: body.storageQuotaGb },
          principal.userId,
        );
        if (!result.ok) {
          if (result.error.kind === "TenantNameTaken") throw new AppError("TENANT_NAME_TAKEN");
          throw new AppError("SUBDOMAIN_TAKEN");
        }
        c.header("Location", `/api/v1/tenants/${result.value.id}`);
        return c.json(one(result.value), 201);
      })
      // 3.2
      .openapi(listTenants, async (c) => {
        const query = c.req.valid("query");
        const { rows, total } = await tenancy.listTenants(query);
        const totalPages = Math.ceil(total / query.limit);
        return c.json(page(rows, { page: query.page, limit: query.limit, total, totalPages }), 200);
      })
      // 3.3 — SCAFFOLD: implemented in BE-S2-05.
      .openapi(setTenantQuota, (c) => c.json(one(MOCK_TENANT_ROW), 200))
  );
}
