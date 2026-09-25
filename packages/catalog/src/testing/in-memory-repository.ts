import type { DocumentId, DocumentVersionView, Result, TenantId, VersionId } from "@archiva/shared";
import { asDocumentId, asVersionId, err, ok } from "@archiva/shared";
import type * as E from "../errors.ts";
import type { Clock } from "../ports.ts";
import type {
  CatalogRepository,
  DocumentRecord,
  InsertDocumentInput,
  InsertVersionInput,
} from "../repository.ts";

type StoredDocument = {
  id: DocumentId;
  tenantId: TenantId;
  title: string;
  processingState: DocumentRecord["processingState"];
  failureReason?: string | null;
  currentVersionId: VersionId | null;
  uploaderId: string;
  createdAt: string;
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
  pageCount?: number | null;
  uploadedBy: string;
  createdAt: string;
};

export type InMemoryCatalogRepositoryOptions = {
  userNameLookup?: (userId: string) => string;
  clock?: Clock;
};

export function inMemoryCatalogRepository(
  options?: InMemoryCatalogRepositoryOptions,
): CatalogRepository & {
  documents: StoredDocument[];
  versions: StoredVersion[];
} {
  const documents: StoredDocument[] = [];
  const versions: StoredVersion[] = [];
  const userNameLookup = options?.userNameLookup ?? (() => "Test User");
  const clock = options?.clock ?? { now: () => new Date() };

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
      // Synchronous check & write mirrors PostgreSQL UNIQUE (tenant_id, content_hash) constraint
      const existing = versions.find(
        (v) => v.tenantId === tenantId && v.contentHash === input.contentHash,
      );
      if (existing) {
        return err({
          kind: "DuplicateContent",
          existingDocumentId: existing.documentId,
        });
      }

      const docId = input.documentId ?? asDocumentId(crypto.randomUUID());
      const verId = input.versionId ?? asVersionId(crypto.randomUUID());
      const now = clock.now().toISOString();

      const doc: StoredDocument = {
        id: docId,
        tenantId,
        title: input.filename,
        processingState: "queued",
        currentVersionId: verId,
        uploaderId: input.uploaderId,
        createdAt: now,
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
        createdAt: now,
      };
      versions.push(ver);

      return ok({
        id: docId,
        title: doc.title,
        processingState: doc.processingState,
        uploaderId: doc.uploaderId,
        uploaderName: userNameLookup(doc.uploaderId),
        createdAt: doc.createdAt,
      });
    },

    async findDocument(tenantId: TenantId, documentId: DocumentId): Promise<DocumentRecord | null> {
      const doc = documents.find((d) => d.tenantId === tenantId && d.id === documentId);
      if (!doc) return null;
      const curVer = versions.find((v) => v.id === doc.currentVersionId);
      return {
        id: doc.id,
        title: doc.title,
        processingState: doc.processingState,
        failureReason: doc.failureReason ?? null,
        currentVersionId: doc.currentVersionId,
        currentVersionHash: curVer?.contentHash ?? null,
        currentMimeType: curVer?.mimeType ?? null,
        uploaderId: doc.uploaderId,
        uploaderName: userNameLookup(doc.uploaderId),
        createdAt: doc.createdAt,
      };
    },

    async findBlobKey(tenantId: TenantId, versionId: VersionId): Promise<string | null> {
      const ver = versions.find((v) => v.tenantId === tenantId && v.id === versionId);
      return ver ? ver.blobKey : null;
    },

    async deleteDocument(tenantId: TenantId, documentId: DocumentId): Promise<void> {
      for (let i = versions.length - 1; i >= 0; i--) {
        const v = versions[i];
        if (v && v.tenantId === tenantId && v.documentId === documentId) {
          versions.splice(i, 1);
        }
      }
      const docIndex = documents.findIndex((d) => d.tenantId === tenantId && d.id === documentId);
      if (docIndex !== -1) {
        documents.splice(docIndex, 1);
      }
    },

    async updateProcessingState(
      tenantId: TenantId,
      documentId: DocumentId,
      state: DocumentRecord["processingState"],
    ): Promise<void> {
      const doc = documents.find((d) => d.tenantId === tenantId && d.id === documentId);
      if (doc) doc.processingState = state;
    },

    async insertVersionAndUpdateDocument(
      tenantId: TenantId,
      input: InsertVersionInput,
    ): Promise<
      Result<
        { versionId: VersionId; versionNumber: number },
        E.IdenticalContent | E.DuplicateContent
      >
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
      const now = clock.now().toISOString();

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
        uploadedBy: input.uploaderId,
        createdAt: now,
      };
      versions.push(ver);

      doc.currentVersionId = versionId;
      doc.processingState = "queued";

      return ok({ versionId, versionNumber });
    },

    async listVersions(
      tenantId: TenantId,
      documentId: DocumentId,
    ): Promise<DocumentVersionView[] | null> {
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
          id: v.uploadedBy,
          name: userNameLookup(v.uploadedBy),
        },
        createdAt: v.createdAt,
        isCurrent: v.id === doc.currentVersionId,
      }));
    },
  };
}
