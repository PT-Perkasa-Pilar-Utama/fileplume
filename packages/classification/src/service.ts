import type {
  CategoryId,
  CategoryView,
  DocumentId,
  Result,
  TenantId,
  UserId,
} from "@archiva/shared";
import { asCategoryId, ok } from "@archiva/shared";
import type * as E from "./errors.ts";
import type { Clock } from "./ports.ts";
import type { CategoryFilter, ClassificationRepository } from "./repository.ts";

export const RESERVED_CATEGORY = "Uncategorized";

export type Category = {
  id: CategoryId;
  name: string;
  isSystem: boolean;
  downloadActive: boolean;
};

export interface ClassificationService {
  createCategory(
    tenantId: TenantId,
    name: string,
    actor: UserId,
  ): Promise<Result<Category, E.DuplicateName>>;
  listCategories(tenantId: TenantId): Promise<Category[]>;
  listCategoryViews(
    tenantId: TenantId,
    filter: CategoryFilter,
  ): Promise<{ rows: CategoryView[]; total: number }>;
  createCategoryView(
    tenantId: TenantId,
    name: string,
    actor: UserId,
  ): Promise<Result<CategoryView, E.DuplicateName>>;
  renameCategory(
    tenantId: TenantId,
    categoryId: CategoryId,
    name: string,
    actor: UserId,
  ): Promise<Result<CategoryView, E.DuplicateName | E.NotFound | E.SystemCategoryImmutable>>;
  setDownloadPermission(
    tenantId: TenantId,
    categoryId: CategoryId,
    active: boolean,
    actor: UserId,
  ): Promise<Result<void, E.NotFound>>;
  canDownloadCategory(tenantId: TenantId, categoryId: CategoryId): Promise<boolean>;
  confirm(
    documentId: DocumentId,
    categoryId: CategoryId,
    actor: UserId,
  ): Promise<Result<void, E.NotFound | E.NotOwner>>;
}

export function createClassificationService(deps: {
  repository: ClassificationRepository;
  clock: Clock;
}): ClassificationService {
  return {
    async createCategory(tenantId, name, actor) {
      const result = await deps.repository.createCategory(tenantId, name, actor);
      if (!result.ok) return result;
      const category = result.value;
      return ok({
        id: asCategoryId(category.id),
        name: category.name,
        isSystem: category.isSystem,
        downloadActive: category.downloadActive,
      });
    },
    listCategories: (tenantId) => deps.repository.listCategories(tenantId),
    listCategoryViews: (tenantId, filter) => deps.repository.listCategoryViews(tenantId, filter),
    createCategoryView: (tenantId, name, actor) =>
      deps.repository.createCategory(tenantId, name, actor),
    renameCategory: (tenantId, id, name, actor) =>
      deps.repository.renameCategory(tenantId, id, name, actor),
    async setDownloadPermission() {
      throw new Error("SCAFFOLD: implement in BE-S5-03");
    },
    canDownloadCategory: (tenantId, categoryId) =>
      deps.repository.isDownloadActive(tenantId, categoryId),
    async confirm() {
      throw new Error("SCAFFOLD: implement in BE-S3-05");
    },
  };
}

/**
 * grooming D4. Unconfirmed and young means uploader-only; confirmed or aged
 * means tenant-wide. Head of Team and above bypass it. There is no stored
 * state for the window, so no sweeper can be late and nothing is stranded.
 */
export function isVisibleToViewer(
  doc: { uploaderId: string; confirmedAt: Date | null; createdAt: Date },
  viewer: { userId: string; bypassesWindow: boolean },
  pendingConfirmationDays: number,
  now: Date,
): boolean {
  if (viewer.bypassesWindow) return true;
  if (doc.confirmedAt !== null) return true;
  if (doc.uploaderId === viewer.userId) return true;
  const windowEnd = new Date(doc.createdAt.getTime() + pendingConfirmationDays * 86400000);
  return now > windowEnd;
}
