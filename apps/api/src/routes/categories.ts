import type { ClassificationService } from "@archiva/classification";
import { AppError, asCategoryId, one, page } from "@archiva/shared";
import type { Context } from "hono";
import type { AppEnv } from "../middleware/context.ts";
import {
  createCategory,
  listCategories,
  renameCategory,
  setDownloadPermission,
} from "./definitions/categories.ts";
import { isCategoryInTenant, MOCK_CATEGORY } from "./mocks.ts";
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
export const createCategoryRoutes = (classification: ClassificationService) =>
  createRouter()
    .openapi(listCategories, async (c) => {
      const tenantId = c.get("principal").tenantId;
      if (!tenantId) throw new AppError("NOT_FOUND");
      const query = c.req.valid("query");
      const result = await classification.listCategoryViews(tenantId, query);
      return c.json(
        page(result.rows, {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / query.limit),
        }),
        200,
      );
    })
    .openapi(createCategory, async (c) => {
      const principal = c.get("principal");
      if (!principal.tenantId) throw new AppError("NOT_FOUND");
      const result = await classification.createCategoryView(
        principal.tenantId,
        c.req.valid("json").name,
        principal.userId,
      );
      if (!result.ok) {
        await c.get("activity").record({
          tenantId: principal.tenantId,
          actorId: principal.userId,
          action: "access.denied",
          subjectType: "category",
          subjectId: null,
          outcome: "denied",
          metadata: { reason: "DuplicateName" },
        });
        throw new AppError("DUPLICATE_NAME");
      }
      c.header("Location", `/api/v1/categories/${result.value.id}`);
      return c.json(one(result.value), 201);
    })
    .openapi(renameCategory, async (c) => {
      const principal = c.get("principal");
      if (!principal.tenantId) throw new AppError("NOT_FOUND");
      const { id } = c.req.valid("param");
      const result = await classification.renameCategory(
        principal.tenantId,
        asCategoryId(id),
        c.req.valid("json").name,
        principal.userId,
      );
      if (!result.ok) {
        await c.get("activity").record({
          tenantId: principal.tenantId,
          actorId: principal.userId,
          action: "access.denied",
          subjectType: "category",
          subjectId: null,
          outcome: "denied",
          metadata:
            result.error.kind === "NotFound"
              ? { attemptedId: id }
              : { attemptedId: id, reason: result.error.kind },
        });
        if (result.error.kind === "DuplicateName") throw new AppError("DUPLICATE_NAME");
        if (result.error.kind === "SystemCategoryImmutable")
          throw new AppError("SYSTEM_CATEGORY_IMMUTABLE");
        throw new AppError("NOT_FOUND");
      }
      return c.json(one(result.value), 200);
    })
    .openapi(setDownloadPermission, async (c) => {
      const { id } = c.req.valid("param");
      await assertCategoryInTenant(c, id);
      return c.json(
        one({ ...MOCK_CATEGORY, downloadActive: c.req.valid("json").downloadActive }),
        200,
      );
    });
