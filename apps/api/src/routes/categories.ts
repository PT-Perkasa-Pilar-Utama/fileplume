import { AppError, one } from "@archiva/shared";
import type { Context } from "hono";
import type { AppEnv } from "../middleware/context.ts";
import {
  createCategory,
  listCategories,
  renameCategory,
  setDownloadPermission,
} from "./definitions/categories.ts";
import { isCategoryInTenant, listOf, MOCK_CATEGORY } from "./mocks.ts";
import { createRouter } from "./router.ts";

/**
 * 6.4, 6.5: A denied cross-tenant attempt writes an access.denied audit event
 * against the caller's own tenant with { attemptedId: id } in metadata, and
 * returns 404, never 403 (CODING_STANDARD 8.4, 8.5).
 */
async function assertCategoryInTenant(c: Context<AppEnv>, categoryId: string): Promise<void> {
  const tenant = c.get("tenant");
  const session = c.get("session");
  if (!isCategoryInTenant(categoryId, tenant?.id ?? null)) {
    if (session.kind === "authenticated" && session.principal.tenantId !== null) {
      await c.get("activity").record({
        tenantId: session.principal.tenantId,
        actorId: session.principal.userId,
        action: "access.denied",
        subjectType: "category",
        subjectId: null,
        outcome: "denied",
        metadata: { attemptedId: categoryId },
      });
    }
    throw new AppError("NOT_FOUND");
  }
}

/** api-specs/06-categories.md. Cards BE-S3-03, BE-S5-03, FE-S3-02, FE-S5-03. */
export const categoryRoutes = createRouter()
  .openapi(listCategories, (c) => c.json(listOf(MOCK_CATEGORY), 200))
  // 6.3, a new category is always Inactive
  .openapi(createCategory, (c) => c.json(one({ ...MOCK_CATEGORY, downloadActive: false }), 201))
  .openapi(renameCategory, async (c) => {
    const { id } = c.req.valid("param");
    await assertCategoryInTenant(c, id);
    return c.json(one(MOCK_CATEGORY), 200);
  })
  .openapi(setDownloadPermission, async (c) => {
    const { id } = c.req.valid("param");
    await assertCategoryInTenant(c, id);
    return c.json(
      one({ ...MOCK_CATEGORY, downloadActive: c.req.valid("json").downloadActive }),
      200,
    );
  });
