import type { DocumentId, Result, TenantId, VersionId } from "@archiva/shared";
import { asDocumentId, asVersionId, err, ok } from "@archiva/shared";
import type * as E from "../errors.ts";
import type { CatalogRepository, InsertDocumentInput } from "../repository.ts";
import type { DocumentRecord } from "../service.ts";

type StoredDocument = {
  id: DocumentId;
  tenantId: TenantId;
  title: string;
  processingState: DocumentRecord["processingState"];
  currentVersionId: VersionId | null;
  uploaderId: string;
};

type StoredVersion = {
  id: VersionId;
  tenantId: TenantId;
  documentId: DocumentId;
  versionNumber: number;
  contentHash: string;
  blobKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
};

export function inMemoryCatalogRepository(): CatalogRepository & {
  documents: StoredDocument[];
  versions: StoredVersion[];
} {
  const documents: StoredDocument[] = [];
  const versions: StoredVersion[] = [];

  async function findByContentHash(
    tenantId: TenantId,
    contentHash: string,
  ): Promise<DocumentId | null> {
    const ver = versions.find((v) => v.tenantId === tenantId && v.contentHash === contentHash);
    return ver ? ver.documentId : null;
  }

  return {
    documents,
    versions,
    findByContentHash,

    async insertDocumentWithVersion(
      tenantId: TenantId,
      input: InsertDocumentInput,
    ): Promise<Result<DocumentRecord, E.DuplicateContent>> {
      // Check UNIQUE (tenant_id, content_hash)
      const existingDocId = await findByContentHash(tenantId, input.contentHash);
      if (existingDocId !== null) {
        return err({
          kind: "DuplicateContent",
          existingDocumentId: existingDocId,
        });
      }

      const docId = input.documentId ?? asDocumentId(crypto.randomUUID());
      const verId = input.versionId ?? asVersionId(crypto.randomUUID());

      const doc: StoredDocument = {
        id: docId,
        tenantId,
        title: input.filename,
        processingState: "queued",
        currentVersionId: verId,
        uploaderId: input.uploaderId,
      };
      documents.push(doc);

      const ver: StoredVersion = {
        id: verId,
        tenantId,
        documentId: docId,
        versionNumber: 1,
        contentHash: input.contentHash,
        blobKey: input.blobKey,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedBy: input.uploaderId,
      };
      versions.push(ver);

      return ok({
        id: docId,
        title: doc.title,
        processingState: doc.processingState,
      });
    },

    async allocateVersionNumber(tenantId: TenantId, documentId: DocumentId): Promise<number> {
      const docVersions = versions.filter(
        (v) => v.tenantId === tenantId && v.documentId === documentId,
      );
      const maxVer = docVersions.reduce((max, v) => Math.max(max, v.versionNumber), 0);
      return maxVer + 1;
    },

    async findDocument(tenantId: TenantId, documentId: DocumentId): Promise<DocumentRecord | null> {
      const doc = documents.find((d) => d.tenantId === tenantId && d.id === documentId);
      if (!doc) return null;
      return {
        id: doc.id,
        title: doc.title,
        processingState: doc.processingState,
      };
    },

    async findBlobKey(tenantId: TenantId, versionId: VersionId): Promise<string | null> {
      const ver = versions.find((v) => v.tenantId === tenantId && v.id === versionId);
      return ver ? ver.blobKey : null;
    },

    async updateProcessingState(
      tenantId: TenantId,
      documentId: DocumentId,
      state: DocumentRecord["processingState"],
    ): Promise<void> {
      const doc = documents.find((d) => d.tenantId === tenantId && d.id === documentId);
      if (doc) doc.processingState = state;
    },
  };
}
