import { schema } from "@archiva/db";
import type { UserId } from "@archiva/shared";
import { hasRoleAtLeast } from "@archiva/shared";
import { and, eq, isNotNull, isNull, or, type SQL, sql } from "drizzle-orm";
import type { ViewerContext } from "./list-document-query.ts";

export function documentVisibilityCondition(
  viewer: ViewerContext,
  pendingConfirmationDays: number,
  now: Date,
): SQL | undefined {
  const uploadedByViewer = eq(schema.documents.uploaderId, viewer.userId);
  const scanned = isNotNull(schema.documentVersions.malwareScannedAt);
  const visibleAfterScan = hasRoleAtLeast(viewer.role, "head_of_team")
    ? scanned
    : and(
        scanned,
        or(
          isNotNull(schema.documentClassification.confirmedAt),
          uploadedByViewer,
          sql`${schema.documents.createdAt} + (${pendingConfirmationDays} * interval '1 day') < ${now}`,
        ),
      );

  return and(
    isNull(schema.documentVersions.malwareSignature),
    or(uploadedByViewer, visibleAfterScan),
  );
}

export function isDocumentVisibleInMemory(
  params: {
    uploaderId: UserId;
    categoryConfirmedAt: Date | null;
    createdAt: Date;
    malwareScannedAt: Date | null | undefined;
    malwareSignature: string | null | undefined;
  },
  viewer: ViewerContext,
  pendingConfirmationDays: number,
  now: Date,
): boolean {
  if (params.malwareSignature !== null && params.malwareSignature !== undefined) return false;
  if (params.uploaderId === viewer.userId) return true;
  // Undefined is reserved for legacy in-memory fixtures, which model already-clean documents.
  if (params.malwareScannedAt === null) return false;

  return (
    hasRoleAtLeast(viewer.role, "head_of_team") ||
    params.categoryConfirmedAt !== null ||
    params.createdAt.getTime() + pendingConfirmationDays * 86_400_000 < now.getTime()
  );
}
