import { one } from "@archiva/shared";
import { createTenant, listTenants, setTenantQuota } from "./definitions/tenants.ts";
import { listOf, MOCK_TENANT, MOCK_TENANT_ROW } from "./mocks.ts";
import { createRouter } from "./router.ts";

/** api-specs/03-tenants.md. Served on the reserved admin subdomain. Card BE-S1-01. */
export const tenantRoutes = createRouter()
  .openapi(createTenant, (c) => c.json(one(MOCK_TENANT), 201))
  .openapi(listTenants, (c) => c.json(listOf(MOCK_TENANT_ROW), 200))
  .openapi(setTenantQuota, (c) => c.json(one(MOCK_TENANT_ROW), 200));
