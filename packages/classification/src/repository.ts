import { type Db, schema } from "@archiva/db";
import type {
  CategoryId,
  CategoryView,
  ListCategoriesQuery,
  Result,
  TenantId,
  UserId,
} from "@archiva/shared";
import { asCategoryId, err, ok } from "@archiva/shared";
import { and, asc, count, desc, eq, ilike, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type * as E from "./errors.ts";
import type { Category } from "./service.ts";

export type CategoryFilter = ListCategoriesQuery;

export interface ClassificationRepository {
  createCategory(
    tenantId: TenantId,
    name: string,
    actor: UserId,
  ): Promise<Result<CategoryView, E.DuplicateName>>;
  renameCategory(
    tenantId: TenantId,
    id: CategoryId,
    name: string,
    actor: UserId,
  ): Promise<Result<CategoryView, E.DuplicateName | E.NotFound | E.SystemCategoryImmutable>>;
  listCategoryViews(
    tenantId: TenantId,
    filter: CategoryFilter,
  ): Promise<{ rows: CategoryView[]; total: number }>;
  listCategories(tenantId: TenantId): Promise<Category[]>;
  findCategory(tenantId: TenantId, categoryId: CategoryId): Promise<Category | null>;
  setDownloadActive(tenantId: TenantId, categoryId: CategoryId, active: boolean): Promise<void>;
  isDownloadActive(tenantId: TenantId, categoryId: CategoryId): Promise<boolean>;
}

const { categories, categoryPermissions, documentClassification, documents, users, auditEvents } =
  schema;
const creator = alias(users, "creator");
const updater = alias(users, "updater");
const documentCount = sql<number>`(select count(*)::int from ${documentClassification} inner join ${documents} on ${documents.id} = ${documentClassification.documentId} and ${documents.tenantId} = ${documentClassification.tenantId} where ${documentClassification.tenantId} = ${categories.tenantId} and ${documentClassification.categoryId} = ${categories.id} and ${documents.deletedAt} is null)`;

function uniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const cause =
    "cause" in error && typeof error.cause === "object" && error.cause !== null
      ? error.cause
      : error;
  return (
    "constraint" in cause &&
    cause.constraint === "categories_tenant_name_key" &&
    (("code" in cause && cause.code === "23505") || ("errno" in cause && cause.errno === "23505"))
  );
}

function categoryQuery(db: Db, tenantId: TenantId) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      isSystem: categories.isSystem,
      downloadActive: categoryPermissions.downloadActive,
      documentCount,
      creatorId: creator.id,
      creatorName: creator.name,
      createdAt: categories.createdAt,
      updaterId: updater.id,
      updaterName: updater.name,
      permissionUpdatedAt: categoryPermissions.updatedAt,
    })
    .from(categories)
    .innerJoin(
      categoryPermissions,
      and(
        eq(categoryPermissions.categoryId, categories.id),
        eq(categoryPermissions.tenantId, tenantId),
      ),
    )
    .innerJoin(creator, eq(creator.id, categories.createdBy))
    .innerJoin(updater, eq(updater.id, categoryPermissions.updatedBy))
    .$dynamic();
}

type CategoryRow = Awaited<ReturnType<typeof categoryQuery>>[number];
function toView(row: CategoryRow): CategoryView {
  return {
    id: row.id,
    name: row.name,
    isSystem: row.isSystem,
    downloadActive: row.downloadActive,
    documentCount: row.documentCount,
    createdBy: row.isSystem ? null : { id: row.creatorId, name: row.creatorName },
    createdAt: row.createdAt.toISOString(),
    permissionUpdatedAt: row.permissionUpdatedAt.toISOString(),
    permissionUpdatedBy: { id: row.updaterId, name: row.updaterName },
  };
}

export function createDrizzleClassificationRepository(db: Db): ClassificationRepository {
  async function getView(tenantId: TenantId, id: CategoryId): Promise<CategoryView | null> {
    const [row] = await categoryQuery(db, tenantId).where(
      and(eq(categories.tenantId, tenantId), eq(categories.id, id)),
    );
    return row ? toView(row) : null;
  }
  return {
    async createCategory(tenantId, name, actor) {
      try {
        const id = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(categories)
            .values({ tenantId, name, createdBy: actor })
            .returning({ id: categories.id });
          if (!row) throw new Error("category insert returned no row");
          await tx
            .insert(categoryPermissions)
            .values({ tenantId, categoryId: row.id, downloadActive: false, updatedBy: actor });
          await tx.insert(auditEvents).values({
            tenantId,
            actorId: actor,
            action: "category.create",
            subjectType: "category",
            subjectId: row.id,
            outcome: "allowed",
          });
          return asCategoryId(row.id);
        });
        const view = await getView(tenantId, id);
        if (!view) throw new Error("created category not found");
        return ok(view);
      } catch (error) {
        if (uniqueViolation(error)) return err({ kind: "DuplicateName" });
        throw error;
      }
    },
    async renameCategory(tenantId, id, name, actor) {
      try {
        const result = await db.transaction(async (tx) => {
          const [row] = await tx
            .select({ name: categories.name, isSystem: categories.isSystem })
            .from(categories)
            .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)))
            .for("update");
          if (!row) return err({ kind: "NotFound" } as const);
          if (row.isSystem) return err({ kind: "SystemCategoryImmutable" } as const);
          await tx
            .update(categories)
            .set({ name })
            .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)));
          await tx.insert(auditEvents).values({
            tenantId,
            actorId: actor,
            action: "category.create",
            subjectType: "category",
            subjectId: id,
            outcome: "allowed",
            metadata: { action: "rename", previousName: row.name, name },
          });
          return ok(undefined);
        });
        if (!result.ok) return result;
        const view = await getView(tenantId, id);
        if (!view) throw new Error("renamed category not found");
        return ok(view);
      } catch (error) {
        if (uniqueViolation(error)) return err({ kind: "DuplicateName" });
        throw error;
      }
    },
    async listCategoryViews(tenantId, filter) {
      const where = and(
        eq(categories.tenantId, tenantId),
        filter.q ? ilike(categories.name, `%${filter.q}%`) : undefined,
      );
      const [total] = await db.select({ total: count() }).from(categories).where(where);
      const sort = { name: categories.name, createdAt: categories.createdAt, documentCount }[
        filter.sort
      ];
      const rows = await categoryQuery(db, tenantId)
        .where(where)
        .orderBy(filter.order === "asc" ? asc(sort) : desc(sort), asc(categories.id))
        .limit(filter.limit)
        .offset((filter.page - 1) * filter.limit);
      return { rows: rows.map(toView), total: total?.total ?? 0 };
    },
    async listCategories(tenantId) {
      const rows = await categoryQuery(db, tenantId).where(eq(categories.tenantId, tenantId));
      return rows.map((row) => ({
        id: asCategoryId(row.id),
        name: row.name,
        isSystem: row.isSystem,
        downloadActive: row.downloadActive,
      }));
    },
    async findCategory(tenantId, id) {
      const view = await getView(tenantId, id);
      return view
        ? {
            id: asCategoryId(view.id),
            name: view.name,
            isSystem: view.isSystem,
            downloadActive: view.downloadActive,
          }
        : null;
    },
    async setDownloadActive() {
      throw new Error("SCAFFOLD: implement in BE-S5-03");
    },
    async isDownloadActive(tenantId, id) {
      const [row] = await db
        .select({ active: categoryPermissions.downloadActive })
        .from(categoryPermissions)
        .where(
          and(eq(categoryPermissions.tenantId, tenantId), eq(categoryPermissions.categoryId, id)),
        );
      return row?.active ?? false;
    },
  };
}
