import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { DocumentId, Result, TenantId, UserId, VersionId } from "@archiva/shared";
import { asDocumentId, asVersionId, err, ok } from "@archiva/shared";
import { and, eq, sql } from "drizzle-orm";
import type * as E from "../errors.ts";
import type { DocumentRecord } from "../service.ts";
import { isUniqueViolationOn } from "./unique-violation.ts";

export type InsertDocumentInput = {
  documentId?: DocumentId;
  versionId?: VersionId;
  uploaderId: UserId;
  contentHash: string;
  blobKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export async function insertDocumentWithVersionTx(
  db: Db,
  tenantId: TenantId,
  input: InsertDocumentInput,
  findByContentHash: (tenantId: TenantId, contentHash: string) => Promise<DocumentId | null>,
): Promise<Result<DocumentRecord, E.DuplicateContent>> {
  try {
    return await db.transaction(async (tx) => {
      const docId = input.documentId ?? asDocumentId(crypto.randomUUID());
      const verId = input.versionId ?? asVersionId(crypto.randomUUID());

      const [doc] = await tx
        .insert(schema.documents)
        .values({
          id: docId,
          tenantId,
          uploaderId: input.uploaderId,
          title: input.filename,
          processingState: "queued",
        })
        .returning({
          id: schema.documents.id,
          title: schema.documents.title,
          processingState: schema.documents.processingState,
        });

      if (!doc) throw new Error("insertDocumentWithVersion: document insert returned no row");

      const [ver] = await tx
        .insert(schema.documentVersions)
        .values({
          id: verId,
          tenantId,
          documentId: doc.id,
          versionNumber: 1,
          contentHash: input.contentHash,
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          blobKey: input.blobKey,
          uploadedBy: input.uploaderId,
        })
        .returning({ id: schema.documentVersions.id });

      if (!ver) throw new Error("insertDocumentWithVersion: version insert returned no row");

      await tx
        .update(schema.documents)
        .set({ currentVersionId: ver.id })
        .where(and(eq(schema.documents.id, doc.id), eq(schema.documents.tenantId, tenantId)));

      return ok({
        id: asDocumentId(doc.id),
        title: doc.title,
        processingState: doc.processingState,
      });
    });
  } catch (caughtErr) {
    if (isUniqueViolationOn(caughtErr, "document_versions_tenant_hash_key")) {
      // The loser of the insert race reads back the winner. AC-03.04.
      const existingId = await findByContentHash(tenantId, input.contentHash);
      return existingId
        ? err({ kind: "DuplicateContent", existingDocumentId: existingId })
        : err({ kind: "DuplicateContent" });
    }
    throw caughtErr;
  }
}

export async function allocateVersionNumberTx(
  db: Db,
  tenantId: TenantId,
  documentId: DocumentId,
): Promise<number> {
  return await db.transaction(async (tx) => {
    await tx
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(and(eq(schema.documents.id, documentId), eq(schema.documents.tenantId, tenantId)))
      .for("update");

    const [row] = await tx
      .select({
        maxVer: sql<number>`coalesce(max(${schema.documentVersions.versionNumber}), 0)`,
      })
      .from(schema.documentVersions)
      .where(
        and(
          eq(schema.documentVersions.documentId, documentId),
          eq(schema.documentVersions.tenantId, tenantId),
        ),
      );
    return (row?.maxVer ?? 0) + 1;
  });
}
