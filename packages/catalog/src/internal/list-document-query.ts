import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { Role, TenantId, UserId } from "@archiva/shared";
import { asDocumentId, asTenantId, asUserId, asVersionId, hasRoleAtLeast } from "@archiva/shared";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { RawDocumentRow } from "./document-views.ts";

export type ListDocumentsFilter = {
  page: number;
  limit: number;
  sort?: "createdAt" | "title" | "sizeBytes";
  order?: "asc" | "desc";
  categoryId?: string;
  tags?: string[];
  state?: Array<"queued" | "processing" | "ready" | "failed">;
  unconfirmedOnly?: boolean;
  uploaderId?: string;
};

export type ViewerContext = {
  userId: UserId;
  role: Role;
};

export async function countTenantDocuments(db: Db, tenantId: TenantId): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(schema.documents)
    .where(and(eq(schema.documents.tenantId, tenantId), isNull(schema.documents.deletedAt)));
  return row ? Number(row.total) : 0;
}

export async function queryListDocuments(
  db: Db,
  tenantId: TenantId,
  filter: ListDocumentsFilter,
  viewer: ViewerContext,
  pendingConfirmationDays: number,
  now: Date,
): Promise<{ rows: RawDocumentRow[]; total: number }> {
  const conditions = [eq(schema.documents.tenantId, tenantId), isNull(schema.documents.deletedAt)];

  // 05-documents.md 5.4.1: head_of_team and above bypass the window entirely.
  if (!hasRoleAtLeast(viewer.role, "head_of_team")) {
    const vis = or(
      isNotNull(schema.documentClassification.confirmedAt),
      eq(schema.documents.uploaderId, viewer.userId),
      sql`${schema.documents.createdAt} + (${pendingConfirmationDays} * interval '1 day') < ${now}`,
    );
    if (vis) conditions.push(vis);
  }

  if (filter.categoryId) {
    conditions.push(eq(schema.documentClassification.categoryId, filter.categoryId));
  }
  if (filter.state && filter.state.length > 0) {
    conditions.push(inArray(schema.documents.processingState, filter.state));
  }
  if (filter.unconfirmedOnly) {
    conditions.push(isNull(schema.documentClassification.confirmedAt));
  }
  if (filter.uploaderId) {
    conditions.push(eq(schema.documents.uploaderId, filter.uploaderId));
  }
  if (filter.tags && filter.tags.length > 0) {
    for (const tag of filter.tags) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${schema.documentTags} dt
          WHERE dt.document_id = ${schema.documents.id}
            AND dt.tenant_id = ${tenantId}
            AND dt.tag = ${tag}
        )`,
      );
    }
  }

  const [countRow] = await db
    .select({ total: count() })
    .from(schema.documents)
    .leftJoin(
      schema.documentClassification,
      eq(schema.documents.id, schema.documentClassification.documentId),
    )
    .where(and(...conditions));
  const total = countRow ? Number(countRow.total) : 0;

  const sortField = filter.sort ?? "createdAt";
  const sortOrder = filter.order ?? "desc";

  let orderClause = desc(schema.documents.createdAt);
  if (sortField === "title") {
    orderClause = sortOrder === "asc" ? asc(schema.documents.title) : desc(schema.documents.title);
  } else if (sortField === "sizeBytes") {
    orderClause =
      sortOrder === "asc"
        ? asc(schema.documentVersions.sizeBytes)
        : desc(schema.documentVersions.sizeBytes);
  } else {
    orderClause =
      sortOrder === "asc" ? asc(schema.documents.createdAt) : desc(schema.documents.createdAt);
  }

  const offset = (filter.page - 1) * filter.limit;
  const rows = await db
    .select({
      id: schema.documents.id,
      tenantId: schema.documents.tenantId,
      title: schema.documents.title,
      currentVersionId: schema.documents.currentVersionId,
      processingState: schema.documents.processingState,
      failureReason: schema.documents.failureReason,
      createdAt: schema.documents.createdAt,
      uploaderId: schema.documents.uploaderId,
      uploaderName: schema.users.name,
      versionNumber: schema.documentVersions.versionNumber,
      filename: schema.documentVersions.filename,
      mimeType: schema.documentVersions.mimeType,
      sizeBytes: schema.documentVersions.sizeBytes,
      pageCount: schema.documentVersions.pageCount,
      versionCount: sql<number>`(SELECT count(*)::int FROM ${schema.documentVersions} dv WHERE dv.document_id = ${schema.documents.id})`,
      categoryId: schema.documentClassification.categoryId,
      categoryName: schema.categories.name,
      categoryIsSystem: schema.categories.isSystem,
      categoryConfirmedAt: schema.documentClassification.confirmedAt,
      categoryDownloadActive: schema.categoryPermissions.downloadActive,
      documentType: schema.documentClassification.documentType,
    })
    .from(schema.documents)
    .innerJoin(schema.users, eq(schema.documents.uploaderId, schema.users.id))
    .innerJoin(
      schema.documentVersions,
      eq(schema.documents.currentVersionId, schema.documentVersions.id),
    )
    .leftJoin(
      schema.documentClassification,
      eq(schema.documents.id, schema.documentClassification.documentId),
    )
    .leftJoin(schema.categories, eq(schema.documentClassification.categoryId, schema.categories.id))
    .leftJoin(
      schema.categoryPermissions,
      eq(schema.categories.id, schema.categoryPermissions.categoryId),
    )
    .where(and(...conditions))
    .orderBy(orderClause, desc(schema.documents.id))
    .limit(filter.limit)
    .offset(offset);

  const docIds = rows.map((r) => r.id);
  const tagsByDocId = new Map<string, string[]>();
  if (docIds.length > 0) {
    const tagRows = await db
      .select({
        documentId: schema.documentTags.documentId,
        tag: schema.documentTags.tag,
      })
      .from(schema.documentTags)
      .where(
        and(
          eq(schema.documentTags.tenantId, tenantId),
          inArray(schema.documentTags.documentId, docIds),
        ),
      );
    for (const t of tagRows) {
      const list = tagsByDocId.get(t.documentId) ?? [];
      list.push(t.tag);
      tagsByDocId.set(t.documentId, list);
    }
  }

  const resultRows: RawDocumentRow[] = rows.map((r) => ({
    id: asDocumentId(r.id),
    tenantId: asTenantId(r.tenantId),
    title: r.title,
    currentVersionId: r.currentVersionId ? asVersionId(r.currentVersionId) : null,
    processingState: r.processingState,
    failureReason: r.failureReason,
    createdAt: r.createdAt,
    uploaderId: asUserId(r.uploaderId),
    uploaderName: r.uploaderName,
    versionNumber: Number(r.versionNumber),
    filename: r.filename,
    mimeType: r.mimeType,
    sizeBytes: Number(r.sizeBytes),
    pageCount: r.pageCount,
    versionCount: Number(r.versionCount),
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    categoryIsSystem: r.categoryIsSystem,
    categoryConfirmedAt: r.categoryConfirmedAt,
    categoryDownloadActive: r.categoryDownloadActive,
    documentType: r.documentType,
    tags: tagsByDocId.get(r.id) ?? [],
  }));

  return { rows: resultRows, total };
}
