import { asDocumentId, asTenantId, asUserId, asVersionId } from "@archiva/shared";
import type { StoredDocument, StoredVersion } from "./in-memory-types.ts";

export const DEFAULT_DOC_A_ID = asDocumentId("0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01");
export const DEFAULT_TENANT_A_ID = asTenantId("1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b");
export const DEFAULT_DOC_B_ID = asDocumentId("991ba4a4-6a73-5755-8118-260707e7d4d1");
export const DEFAULT_TENANT_B_ID = asTenantId("5b4a3f2e-1d0c-4b9a-8f7e-6d5c4b3a2f10");
export const DEFAULT_VER_A_ID = asVersionId("0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e02");
export const DEFAULT_VER_B_ID = asVersionId("991ba4a4-6a73-5755-8118-260707e7d4d2");

export function createDefaultFixtures(): {
  documents: StoredDocument[];
  versions: StoredVersion[];
} {
  const docA: StoredDocument = {
    id: DEFAULT_DOC_A_ID,
    tenantId: DEFAULT_TENANT_A_ID,
    title: "kontrak-kerjasama.pdf",
    processingState: "ready",
    failureReason: null,
    currentVersionId: DEFAULT_VER_A_ID,
    uploaderId: asUserId("22222222-2222-4222-8222-222222222222"),
    uploaderName: "Budi Santoso",
    createdAt: new Date("2026-09-10T05:20:44.000Z"),
    categoryId: "00000000-0000-4000-8000-000000000010",
    categoryName: "Legal",
    categoryIsSystem: false,
    categoryConfirmedAt: new Date("2026-09-10T05:20:44.000Z"),
    categoryDownloadActive: true,
    documentType: "Perjanjian Kerjasama",
    tags: ["legal", "kontrak"],
    author: "Legal Team",
    documentCreatedAt: new Date("2026-09-01T00:00:00.000Z"),
  };
  const verA: StoredVersion = {
    id: DEFAULT_VER_A_ID,
    tenantId: DEFAULT_TENANT_A_ID,
    documentId: DEFAULT_DOC_A_ID,
    versionNumber: 1,
    contentHash: "hash-a",
    blobKey: `t/${DEFAULT_TENANT_A_ID}/d/${DEFAULT_DOC_A_ID}/v/${DEFAULT_VER_A_ID}`,
    filename: "kontrak-kerjasama.pdf",
    mimeType: "application/pdf",
    sizeBytes: 245760,
    pageCount: 3,
    uploadedById: docA.uploaderId,
    uploadedByName: docA.uploaderName,
    createdAt: docA.createdAt,
  };
  const docB: StoredDocument = {
    id: DEFAULT_DOC_B_ID,
    tenantId: DEFAULT_TENANT_B_ID,
    title: "rahasia-b.pdf",
    processingState: "ready",
    failureReason: null,
    currentVersionId: DEFAULT_VER_B_ID,
    uploaderId: asUserId("55555555-5555-4555-8555-555555555555"),
    uploaderName: "Mitra User",
    createdAt: new Date("2026-09-10T05:20:44.000Z"),
    categoryId: null,
    categoryName: null,
    categoryIsSystem: null,
    categoryConfirmedAt: null,
    categoryDownloadActive: null,
    documentType: null,
    tags: [],
    author: null,
    documentCreatedAt: null,
  };
  const verB: StoredVersion = {
    id: DEFAULT_VER_B_ID,
    tenantId: DEFAULT_TENANT_B_ID,
    documentId: DEFAULT_DOC_B_ID,
    versionNumber: 1,
    contentHash: "hash-b",
    blobKey: `t/${DEFAULT_TENANT_B_ID}/d/${DEFAULT_DOC_B_ID}/v/${DEFAULT_VER_B_ID}`,
    filename: "rahasia-b.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    pageCount: 1,
    uploadedById: docB.uploaderId,
    uploadedByName: docB.uploaderName,
    createdAt: docB.createdAt,
  };

  return {
    documents: [docA, docB],
    versions: [verA, verB],
  };
}
