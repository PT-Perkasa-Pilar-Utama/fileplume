import type { DocumentId, DocumentVersionView, Result, TenantId, VersionId } from "@archiva/shared";
import { asVersionId, err, ok } from "@archiva/shared";
import type * as E from "../errors.ts";
import type { Clock } from "../ports.ts";
import type { InsertVersionInput } from "../repository.ts";
import type { StoredDocument, StoredVersion } from "./in-memory-types.ts";

export async function handleInsertVersion(
  documents: StoredDocument[],
  versions: StoredVersion[],
  tenantId: TenantId,
  input: InsertVersionInput,
  findByContentHash: (tenantId: TenantId, contentHash: string) => Promise<DocumentId | null>,
  clock: Clock,
  userNameLookup: (userId: string) => string,
): Promise<
  Result<{ versionId: VersionId; versionNumber: number }, E.IdenticalContent | E.DuplicateContent>
> {
  const doc = documents.find((d) => d.tenantId === tenantId && d.id === input.documentId);
  if (!doc) throw new Error("Document not found");

  if (doc.currentVersionId) {
    const curVer = versions.find((v) => v.id === doc.currentVersionId);
    if (curVer?.contentHash === input.contentHash) {
      return err({ kind: "IdenticalContent" });
    }
  }

  const existingDocId = await findByContentHash(tenantId, input.contentHash);
  if (existingDocId) {
    if (existingDocId === input.documentId) {
      return err({ kind: "IdenticalContent" });
    }
    return err({ kind: "DuplicateContent", existingDocumentId: existingDocId });
  }

  const docVersions = versions.filter(
    (v) => v.tenantId === tenantId && v.documentId === input.documentId,
  );
  const maxVer = docVersions.reduce((max, v) => Math.max(max, v.versionNumber), 0);
  const versionNumber = maxVer + 1;
  const versionId = input.versionId ?? asVersionId(crypto.randomUUID());
  const nowDate = clock.now();

  const ver: StoredVersion = {
    id: versionId,
    tenantId,
    documentId: input.documentId,
    versionNumber,
    contentHash: input.contentHash,
    blobKey: input.blobKey,
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    pageCount: null,
    uploadedById: input.uploaderId,
    uploadedByName: userNameLookup(input.uploaderId),
    createdAt: nowDate,
  };
  versions.push(ver);

  doc.currentVersionId = versionId;
  doc.processingState = "queued";

  return ok({ versionId, versionNumber });
}

export function handleListVersions(
  documents: StoredDocument[],
  versions: StoredVersion[],
  tenantId: TenantId,
  documentId: DocumentId,
  userNameLookup: (userId: string) => string,
): DocumentVersionView[] | null {
  const doc = documents.find((d) => d.tenantId === tenantId && d.id === documentId);
  if (!doc) return null;

  const docVersions = versions
    .filter((v) => v.tenantId === tenantId && v.documentId === documentId)
    .sort((a, b) => b.versionNumber - a.versionNumber);

  return docVersions.map((v) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    filename: v.filename,
    sizeBytes: v.sizeBytes,
    pageCount: v.pageCount ?? null,
    uploadedBy: {
      id: v.uploadedById,
      name: v.uploadedByName ?? userNameLookup(v.uploadedById),
    },
    createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt),
    isCurrent: v.id === doc.currentVersionId,
  }));
}
