import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { DocumentId, DocumentVersionView, Result, TenantId, VersionId } from "@archiva/shared";
import { asVersionId, err, ok } from "@archiva/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import type * as E from "../errors.ts";
import type { InsertVersionInput } from "./repository-types.ts";
import { toDuplicateContentError } from "./unique-violation.ts";

const docMatch = (docId: string, tId: string) =>
  and(eq(schema.documents.id, docId), eq(schema.documents.tenantId, tId));
const verMatch = (docId: string, tId: string) =>
  and(eq(schema.documentVersions.documentId, docId), eq(schema.documentVersions.tenantId, tId));

/**
 * Inserts a new document version under SELECT ... FOR UPDATE on parent document.
 * AC-21.03: Refuses identical content against current version.
 * AC-21.04: Allocates consecutive version number under row lock.
 */
export async function insertVersionAndUpdateDocument(
  db: Db,
  tenantId: TenantId,
  input: InsertVersionInput,
  findByContentHash: (tenantId: string, hash: string) => Promise<DocumentId | null>,
): Promise<
  Result<
    { versionId: VersionId; versionNumber: number },
    E.IdenticalContent | E.DuplicateContent | E.NotFound
  >
> {
  try {
    return await db.transaction(async (tx) => {
      const [doc] = await tx
        .select({
          id: schema.documents.id,
          currentVersionId: schema.documents.currentVersionId,
        })
        .from(schema.documents)
        .where(docMatch(input.documentId, tenantId))
        .for("update");
      if (!doc) return err({ kind: "NotFound" as const });

      if (doc.currentVersionId) {
        const [cur] = await tx
          .select({ contentHash: schema.documentVersions.contentHash })
          .from(schema.documentVersions)
          .where(eq(schema.documentVersions.id, doc.currentVersionId))
          .limit(1);
        if (cur?.contentHash === input.contentHash) {
          return err({ kind: "IdenticalContent" as const });
        }
      }

      const [maxRow] = await tx
        .select({
          maxVer: sql<number>`coalesce(max(${schema.documentVersions.versionNumber}), 0)`,
        })
        .from(schema.documentVersions)
        .where(verMatch(input.documentId, tenantId));
      const versionNumber = (maxRow?.maxVer ?? 0) + 1;
      const versionId = input.versionId ?? asVersionId(crypto.randomUUID());

      await tx.insert(schema.documentVersions).values({
        id: versionId,
        tenantId,
        documentId: input.documentId,
        versionNumber,
        contentHash: input.contentHash,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        blobKey: input.blobKey,
        uploadedBy: input.uploaderId,
      });

      await tx
        .update(schema.documents)
        .set({
          currentVersionId: versionId,
          updatedAt: new Date(),
          processingState: sql`case when ${schema.documents.processingState} in ('ready', 'failed') then 'queued'::processing_state else ${schema.documents.processingState} end`,
          failureReason: null,
        })
        .where(docMatch(input.documentId, tenantId));

      return ok({ versionId, versionNumber });
    });
  } catch (caughtErr) {
    return await toDuplicateContentError(caughtErr, tenantId, input.contentHash, findByContentHash);
  }
}

/**
 * Lists all versions for a document ordered by versionNumber DESC. AC-21.02.
 */
export async function listVersions(
  db: Db,
  tenantId: TenantId,
  documentId: DocumentId,
): Promise<DocumentVersionView[] | null> {
  const [doc] = await db
    .select({
      id: schema.documents.id,
      currentVersionId: schema.documents.currentVersionId,
    })
    .from(schema.documents)
    .where(docMatch(documentId, tenantId))
    .limit(1);
  if (!doc) return null;

  const rows = await db
    .select({
      id: schema.documentVersions.id,
      versionNumber: schema.documentVersions.versionNumber,
      filename: schema.documentVersions.filename,
      sizeBytes: schema.documentVersions.sizeBytes,
      pageCount: schema.documentVersions.pageCount,
      createdAt: schema.documentVersions.createdAt,
      uploaderId: schema.documentVersions.uploadedBy,
      uploaderName: schema.users.name,
    })
    .from(schema.documentVersions)
    .innerJoin(schema.users, eq(schema.documentVersions.uploadedBy, schema.users.id))
    .where(verMatch(documentId, tenantId))
    .orderBy(desc(schema.documentVersions.versionNumber));

  return rows.map((r) => ({
    id: asVersionId(r.id),
    versionNumber: r.versionNumber,
    filename: r.filename,
    sizeBytes: r.sizeBytes,
    pageCount: r.pageCount,
    uploadedBy: { id: r.uploaderId, name: r.uploaderName },
    createdAt: r.createdAt.toISOString(),
    isCurrent: r.id === doc.currentVersionId,
  }));
}
