import type { CategoryId, TenantId } from "@archiva/shared";
import type { Category } from "./service.ts";

export interface ClassificationRepository {
  insertCategoryWithPermission(tenantId: TenantId, name: string): Promise<Category>;
  listCategories(tenantId: TenantId): Promise<Category[]>;
  findCategory(tenantId: TenantId, categoryId: CategoryId): Promise<Category | null>;
  setDownloadActive(tenantId: TenantId, categoryId: CategoryId, active: boolean): Promise<void>;
  isDownloadActive(tenantId: TenantId, categoryId: CategoryId): Promise<boolean>;
}
