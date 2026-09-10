import type { CategoryId, DocumentId, Result, TenantId, UserId } from "@archiva/shared";
import type * as E from "./errors.ts";
import type { Clock } from "./ports.ts";
import type { ClassificationRepository } from "./repository.ts";

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

export function createClassificationService(_deps: {
  repository: ClassificationRepository;
  clock: Clock;
}): ClassificationService {
  throw new Error("SCAFFOLD: implement in BE-S3-03, BE-S3-05, BE-S5-03");
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
