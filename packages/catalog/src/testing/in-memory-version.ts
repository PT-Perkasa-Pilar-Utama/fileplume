import type { DocumentId, Result, TenantId } from "@archiva/shared";
import { asVersionId, err, ok } from "@archiva/shared";
import type * as E from "../errors.ts";
import type { Clock } from "../ports.ts";
import type { InsertVersionInput, VersionInsertReceipt } from "../repository.ts";
import type { StoredDocument, StoredVersion } from "./in-memory-types.ts";

export async function handleInsertVersion(
  documents: StoredDocument[],
  versions: StoredVersion[],
  tenantId: TenantId,
  input: InsertVersionInput,
  findByContentHash: (tenantId: TenantId, contentHash: string) => Promise<DocumentId | null>,
  clock: Clock,
  userNameLookup: (userId: string) => string,
): Promise<Result<VersionInsertReceipt, E.IdenticalContent | E.DuplicateContent | E.NotFound>> {
  const doc = documents.find((d) => d.tenantId === tenantId && d.id === input.documentId);
  if (!doc) return err({ kind: "NotFound" as const });

  if (doc.currentVersionId) {
    const curVer = versions.find((v) => v.id === doc.currentVersionId);
    if (curVer?.contentHash === input.contentHash) {
      return err({ kind: "IdenticalContent" });
    }
  }

  const existingDocId = await findByContentHash(tenantId, input.contentHash);
  if (existingDocId) {
    return err({ kind: "DuplicateContent", existingDocumentId: existingDocId });
  }

  const docVersions = versions.filter(
    (v) => v.tenantId === tenantId && v.documentId === input.documentId,
  );
  const maxVer = docVersions.reduce((max, v) => Math.max(max, v.versionNumber), 0);
  const versionNumber = maxVer + 1;
  const versionId = input.versionId ?? asVersionId(crypto.randomUUID());
  const nowDate = clock.now();
  const previousCurrentVersionId = doc.currentVersionId;
  const previousProcessingState = doc.processingState;
  const previousFailureReason = doc.failureReason;

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
  doc.failureReason = null;

  return ok({
    versionId,
    versionNumber,
    previousCurrentVersionId,
    previousProcessingState,
    previousFailureReason,
  });
}
