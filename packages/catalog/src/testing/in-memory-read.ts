import type { TenantId } from "@archiva/shared";
import { hasRoleAtLeast } from "@archiva/shared";
import type {
  RawDocumentDetail,
  RawDocumentRow,
  RawVersionRow,
} from "../internal/document-views.ts";
import type { ListDocumentsFilter, ViewerContext } from "../internal/list-document-query.ts";
import type { StoredDocument, StoredVersion } from "./in-memory-types.ts";

export function filterAndSortDocuments(
  documents: StoredDocument[],
  versions: StoredVersion[],
  tenantId: TenantId,
  filter: ListDocumentsFilter,
  viewer: ViewerContext,
  pendingConfirmationDays: number,
  now: Date,
): { rows: RawDocumentRow[]; total: number } {
  const windowMs = pendingConfirmationDays * 86_400_000;

  const filtered = documents.filter((d) => {
    if (d.tenantId !== tenantId) return false;

    // Mirrors the SQL adapter's innerJoin on document_versions.
    const curVer = versions.find((v) => v.id === d.currentVersionId);
    if (!curVer) return false;

    const isVisible =
      hasRoleAtLeast(viewer.role, "head_of_team") ||
      d.categoryConfirmedAt !== null ||
      d.uploaderId === viewer.userId ||
      d.createdAt.getTime() + windowMs < now.getTime();
    if (!isVisible) return false;

    if (filter.categoryId && d.categoryId !== filter.categoryId) return false;
    if (filter.state && filter.state.length > 0 && !filter.state.includes(d.processingState)) {
      return false;
    }
    if (filter.unconfirmedOnly && d.categoryConfirmedAt !== null) return false;
    if (filter.uploaderId && d.uploaderId !== filter.uploaderId) return false;
    if (filter.tags && filter.tags.length > 0) {
      // Exact match, mirroring the SQL adapter (list-document-query.ts):
      // the tag EXISTS subquery compares dt.tag = $tag with no lowering.
      const hasAll = filter.tags.every((t) => d.tags.some((tag) => tag === t));
      if (!hasAll) return false;
    }
    return true;
  });

  const sort = filter.sort ?? "createdAt";
  const order = filter.order ?? "desc";

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sort === "title") {
      cmp = a.title.localeCompare(b.title);
    } else if (sort === "sizeBytes") {
      const verA = versions.find((v) => v.id === a.currentVersionId);
      const verB = versions.find((v) => v.id === b.currentVersionId);
      cmp = (verA?.sizeBytes ?? 0) - (verB?.sizeBytes ?? 0);
    } else {
      cmp = a.createdAt.getTime() - b.createdAt.getTime();
    }
    if (cmp !== 0) return order === "asc" ? cmp : -cmp;
    // Tiebreak mirrors the SQL adapter's trailing desc(documents.id).
    return b.id.localeCompare(a.id);
  });

  const offset = (filter.page - 1) * filter.limit;
  const paged = filtered.slice(offset, offset + filter.limit);

  const rows: RawDocumentRow[] = paged.map((d) => {
    const curVer = versions.find((v) => v.id === d.currentVersionId);
    if (!curVer) {
      throw new Error(`Document ${d.id} has no matching current version`);
    }
    const docVersions = versions.filter((v) => v.documentId === d.id);

    return {
      id: d.id,
      tenantId: d.tenantId,
      title: d.title,
      currentVersionId: d.currentVersionId,
      processingState: d.processingState,
      failureReason: d.failureReason,
      createdAt: d.createdAt,
      uploaderId: d.uploaderId,
      uploaderName: d.uploaderName,
      versionNumber: curVer.versionNumber,
      filename: curVer.filename,
      mimeType: curVer.mimeType,
      sizeBytes: curVer.sizeBytes,
      pageCount: curVer.pageCount,
      versionCount: docVersions.length,
      categoryId: d.categoryId,
      categoryName: d.categoryName,
      categoryIsSystem: d.categoryIsSystem,
      categoryConfirmedAt: d.categoryConfirmedAt,
      categoryDownloadActive: d.categoryDownloadActive,
      documentType: d.documentType,
      tags: d.tags,
    };
  });

  return { rows, total: filtered.length };
}

export function buildRawDocumentDetail(
  doc: StoredDocument,
  versions: StoredVersion[],
  viewer: ViewerContext,
  pendingConfirmationDays: number,
  now: Date,
): RawDocumentDetail | null {
  const windowMs = pendingConfirmationDays * 86_400_000;
  const isVisible =
    hasRoleAtLeast(viewer.role, "head_of_team") ||
    doc.categoryConfirmedAt !== null ||
    doc.uploaderId === viewer.userId ||
    doc.createdAt.getTime() + windowMs < now.getTime();
  if (!isVisible) {
    return null;
  }

  const curVer = versions.find((v) => v.id === doc.currentVersionId);
  if (!curVer) {
    return null;
  }

  const docVersions = versions
    .filter((v) => v.documentId === doc.id)
    .sort((a, b) => b.versionNumber - a.versionNumber);

  const rawVersions: RawVersionRow[] = docVersions.map((v) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    filename: v.filename,
    sizeBytes: v.sizeBytes,
    pageCount: v.pageCount,
    uploadedById: v.uploadedById,
    uploadedByName: v.uploadedByName,
    createdAt: v.createdAt,
    isCurrent: doc.currentVersionId === v.id,
  }));

  return {
    id: doc.id,
    tenantId: doc.tenantId,
    title: doc.title,
    currentVersionId: doc.currentVersionId,
    processingState: doc.processingState,
    failureReason: doc.failureReason,
    createdAt: doc.createdAt,
    uploaderId: doc.uploaderId,
    uploaderName: doc.uploaderName,
    versionNumber: curVer.versionNumber,
    filename: curVer.filename,
    mimeType: curVer.mimeType,
    sizeBytes: curVer.sizeBytes,
    pageCount: curVer.pageCount,
    versionCount: docVersions.length,
    categoryId: doc.categoryId,
    categoryName: doc.categoryName,
    categoryIsSystem: doc.categoryIsSystem,
    categoryConfirmedAt: doc.categoryConfirmedAt,
    categoryDownloadActive: doc.categoryDownloadActive,
    documentType: doc.documentType,
    tags: doc.tags,
    author: doc.author,
    documentCreatedAt: doc.documentCreatedAt,
    versions: rawVersions,
  };
}
