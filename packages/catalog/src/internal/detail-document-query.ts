import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { DocumentId, TenantId } from "@archiva/shared";
import { asDocumentId, asTenantId, asUserId, asVersionId, hasRoleAtLeast } from "@archiva/shared";
import { and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { RawDocumentDetail, RawVersionRow } from "./document-views.ts";
import type { ViewerContext } from "./list-document-query.ts";

export async function findDocumentTenant(db: Db, documentId: DocumentId): Promise<TenantId | null> {
  const [row] = await db
    .select({ tenantId: schema.documents.tenantId })
    .from(schema.documents)
    .where(and(eq(schema.documents.id, documentId), isNull(schema.documents.deletedAt)))
    .limit(1);
  return row ? asTenantId(row.tenantId) : null;
}

export async function queryDocumentDetail(
  db: Db,
  tenantId: TenantId,
  documentId: DocumentId,
  viewer: ViewerContext,
  pendingConfirmationDays: number,
  now: Date,
): Promise<RawDocumentDetail | { kind: "cross_tenant" } | null> {
  const conditions = [
    eq(schema.documents.tenantId, tenantId),
    eq(schema.documents.id, documentId),
    isNull(schema.documents.deletedAt),
  ];

  // 05-documents.md 5.4.1: head_of_team and above bypass the window entirely.
  if (!hasRoleAtLeast(viewer.role, "head_of_team")) {
    const vis = or(
      isNotNull(schema.documentClassification.confirmedAt),
      eq(schema.documents.uploaderId, viewer.userId),
      sql`${schema.documents.createdAt} + (${pendingConfirmationDays} * interval '1 day') < ${now}`,
    );
    if (vis) conditions.push(vis);
  }

  const [doc] = await db
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
    .limit(1);

  if (!doc) {
    const crossCheck = await findDocumentTenant(db, documentId);
    if (crossCheck !== null && crossCheck !== tenantId) {
      return { kind: "cross_tenant" };
    }
    return null;
  }

  const [metaRow] = await db
    .select({
      author: schema.documentMetadata.author,
      documentCreatedAt: schema.documentMetadata.documentCreatedAt,
    })
    .from(schema.documentMetadata)
    .where(
      and(
        eq(schema.documentMetadata.tenantId, tenantId),
        eq(schema.documentMetadata.documentId, documentId),
      ),
    )
    .limit(1);

  const versionRows = await db
    .select({
      id: schema.documentVersions.id,
      versionNumber: schema.documentVersions.versionNumber,
      filename: schema.documentVersions.filename,
      sizeBytes: schema.documentVersions.sizeBytes,
      pageCount: schema.documentVersions.pageCount,
      createdAt: schema.documentVersions.createdAt,
      uploadedById: schema.documentVersions.uploadedBy,
      uploadedByName: schema.users.name,
    })
    .from(schema.documentVersions)
    .innerJoin(schema.users, eq(schema.documentVersions.uploadedBy, schema.users.id))
    .where(
      and(
        eq(schema.documentVersions.tenantId, tenantId),
        eq(schema.documentVersions.documentId, documentId),
      ),
    )
    .orderBy(desc(schema.documentVersions.versionNumber));

  const tagRows = await db
    .select({ tag: schema.documentTags.tag })
    .from(schema.documentTags)
    .where(
      and(
        eq(schema.documentTags.tenantId, tenantId),
        eq(schema.documentTags.documentId, documentId),
      ),
    );

  const versions: RawVersionRow[] = versionRows.map((v) => ({
    id: asVersionId(v.id),
    versionNumber: Number(v.versionNumber),
    filename: v.filename,
    sizeBytes: Number(v.sizeBytes),
    pageCount: v.pageCount,
    uploadedById: asUserId(v.uploadedById),
    uploadedByName: v.uploadedByName,
    createdAt: v.createdAt,
    isCurrent: doc.currentVersionId === v.id,
  }));

  return {
    id: asDocumentId(doc.id),
    tenantId: asTenantId(doc.tenantId),
    title: doc.title,
    currentVersionId: doc.currentVersionId ? asVersionId(doc.currentVersionId) : null,
    processingState: doc.processingState,
    failureReason: doc.failureReason,
    createdAt: doc.createdAt,
    uploaderId: asUserId(doc.uploaderId),
    uploaderName: doc.uploaderName,
    versionNumber: Number(doc.versionNumber),
    filename: doc.filename,
    mimeType: doc.mimeType,
    sizeBytes: Number(doc.sizeBytes),
    pageCount: doc.pageCount,
    versionCount: Number(doc.versionCount),
    categoryId: doc.categoryId,
    categoryName: doc.categoryName,
    categoryIsSystem: doc.categoryIsSystem,
    categoryConfirmedAt: doc.categoryConfirmedAt,
    categoryDownloadActive: doc.categoryDownloadActive,
    documentType: doc.documentType,
    tags: tagRows.map((t) => t.tag),
    author: metaRow?.author ?? null,
    documentCreatedAt: metaRow?.documentCreatedAt ?? null,
    versions,
  };
}
