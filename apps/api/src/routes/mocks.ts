import { page } from "@archiva/shared";

/**
 * Typed mock constants. Every stub returns a contract-valid response matching
 * docs/api-specs/, so the frontend integrates from day one and no one is
 * blocked. Each constant is replaced by real behaviour in the card named
 * beside it in docs/TASK_BREAKDOWN.md.
 */
const TENANT_ID = "1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b";
const USER_ID = "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10";
const DOC_ID = "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01";
const CATEGORY_ID = "7b2f0c93-1d84-4a6e-9b52-6c7d8e9f0a1b";
const VERSION_ID = "aa11b2c3-4d5e-4f60-8a1b-2c3d4e5f6071";

export const MOCK_USER = {
  id: USER_ID,
  name: "Budi Santoso",
  email: "budi@contohbaru.co.id",
  role: "member" as const,
  avatarUrl: null,
};

export const MOCK_TENANT = { id: TENANT_ID, name: "PT Contoh Baru", subdomain: "contohbaru" };

export const MOCK_UPLOADER = { id: USER_ID, name: "Budi Santoso" };

export const MOCK_CATEGORY = {
  id: CATEGORY_ID,
  name: "Technical Spec",
  isSystem: false,
  downloadActive: false,
  documentCount: 34,
  createdBy: MOCK_UPLOADER,
  createdAt: "2026-09-02T07:40:00.000Z",
  permissionUpdatedAt: null,
  permissionUpdatedBy: null,
};

export const MOCK_DOCUMENT = {
  id: DOC_ID,
  title: "kontrak-kerjasama.pdf",
  filename: "kontrak-kerjasama.pdf",
  mimeType: "application/pdf",
  fileType: "pdf" as const,
  sizeBytes: 2411520,
  pageCount: 42,
  versionNumber: 1,
  versionCount: 1,
  processingState: "ready" as const,
  processingLabel: "Siap",
  failureReason: null,
  uploader: MOCK_UPLOADER,
  category: { id: CATEGORY_ID, name: "Technical Spec", isSuggestion: false, isSystem: false },
  documentType: "Kontrak",
  tags: ["legal", "kerjasama", "2026"],
  downloadAllowed: true,
  createdAt: "2026-09-01T09:00:00.000Z",
};

export const MOCK_VERSION = {
  id: VERSION_ID,
  versionNumber: 1,
  filename: "kontrak-kerjasama.pdf",
  sizeBytes: 2411520,
  pageCount: 42,
  uploadedBy: MOCK_UPLOADER,
  createdAt: "2026-09-01T09:00:00.000Z",
  isCurrent: true,
};

export const MOCK_DOCUMENT_DETAIL = {
  ...MOCK_DOCUMENT,
  metadata: { author: "Sari Dewi", documentCreatedAt: "2026-03-04T00:00:00.000Z" },
  versions: [MOCK_VERSION],
};

export const MOCK_META = { page: 1, limit: 10, total: 1, totalPages: 1 };

export const listOf = <T>(item: T) => page([item], MOCK_META);
