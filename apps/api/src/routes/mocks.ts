import type {
  analyticsDashboardSchema,
  auditEventSchema,
  bulkDownloadTicketSchema,
  categorySchema,
  classifiedDocumentSchema,
  contentHitSchema,
  documentDetailSchema,
  documentSchema,
  documentVersionSchema,
  personRefSchema,
  principalSchema,
  processingStatusSchema,
  relatedDocumentSchema,
  reprocessAcceptedSchema,
  sessionSchema,
  storageSchema,
  tenantListItemSchema,
  tenantSchema,
  titleHitSchema,
  topTagSchema,
  uploadBatchSchema,
} from "@archiva/shared";
import { page } from "@archiva/shared";
import type { z } from "zod";

/**
 * Typed mock constants. Every stub returns a contract-valid response matching
 * docs/api-specs/, so the frontend integrates from day one and no one is
 * blocked. Each constant is replaced by real behaviour in the card named
 * beside it in docs/TASK_BREAKDOWN.md. mocks.test.ts parses each against its schema.
 */
const TENANT_ID = "1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b";
const USER_ID = "9d1c4a70-7b53-4f0a-8a71-3c9e2d5b6f10";
const DOC_ID = "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01";
const CATEGORY_ID = "7b2f0c93-1d84-4a6e-9b52-6c7d8e9f0a1b";
const VERSION_ID = "aa11b2c3-4d5e-4f60-8a1b-2c3d4e5f6071";
const TICKET_ID = "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b";

export const MOCK_TENANT_A_ID = TENANT_ID;
export const MOCK_TENANT_B_ID = "5b4a3f2e-1d0c-4b9a-8f7e-6d5c4b3a2f10";
export const MOCK_DOC_ID = DOC_ID;
export const MOCK_TENANT_B_DOC_ID = "991ba4a4-6a73-5755-8118-260707e7d4d1";

export function isDocumentInTenant(documentId: string, tenantId: string | null): boolean {
  if (tenantId === MOCK_TENANT_A_ID && documentId === MOCK_DOC_ID) return true;
  if (tenantId === MOCK_TENANT_B_ID && documentId === MOCK_TENANT_B_DOC_ID) return true;
  return false;
}

export const MOCK_UPLOADER: z.infer<typeof personRefSchema> = { id: USER_ID, name: "Budi Santoso" };

export const MOCK_SESSION: z.infer<typeof sessionSchema> = {
  user: {
    id: USER_ID,
    name: "Budi Santoso",
    email: "budi@contohbaru.co.id",
    role: "member",
    avatarUrl: null,
  },
  tenant: { id: TENANT_ID, name: "PT Contoh Baru", subdomain: "contohbaru" },
  expiresAt: "2026-10-10T03:14:07.000Z",
};

export const MOCK_PRINCIPAL: z.infer<typeof principalSchema> = {
  ...MOCK_SESSION,
  menus: ["dashboard", "document"],
};

export const MOCK_TENANT: z.infer<typeof tenantSchema> = {
  id: TENANT_ID,
  name: "PT Contoh Baru",
  subdomain: "contohbaru",
  status: "active",
  storageQuotaBytes: 53687091200,
  storageUsedBytes: 0,
  createdAt: "2026-09-10T02:11:44.000Z",
};

export const MOCK_TENANT_ROW: z.infer<typeof tenantListItemSchema> = {
  ...MOCK_TENANT,
  storageUsedBytes: 13421772800,
  storagePercent: 25,
  documentCount: 412,
  userCount: 9,
};

export const MOCK_STORAGE: z.infer<typeof storageSchema> = {
  usedBytes: 13421772800,
  quotaBytes: 53687091200,
  percent: 25,
  level: "ok",
  message: null,
};

export const MOCK_CATEGORY: z.infer<typeof categorySchema> = {
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

export const MOCK_DOCUMENT: z.infer<typeof documentSchema> = {
  id: DOC_ID,
  title: "kontrak-kerjasama.pdf",
  filename: "kontrak-kerjasama.pdf",
  mimeType: "application/pdf",
  fileType: "pdf",
  sizeBytes: 2411520,
  pageCount: 42,
  versionNumber: 1,
  versionCount: 1,
  processingState: "ready",
  processingLabel: "Siap",
  failureReason: null,
  uploader: MOCK_UPLOADER,
  category: { id: CATEGORY_ID, name: "Technical Spec", isSuggestion: false, isSystem: false },
  documentType: "Kontrak",
  tags: ["legal", "kerjasama", "2026"],
  downloadAllowed: true,
  createdAt: "2026-09-01T09:00:00.000Z",
};

export const MOCK_VERSION: z.infer<typeof documentVersionSchema> = {
  id: VERSION_ID,
  versionNumber: 1,
  filename: "kontrak-kerjasama.pdf",
  sizeBytes: 2411520,
  pageCount: 42,
  uploadedBy: MOCK_UPLOADER,
  createdAt: "2026-09-01T09:00:00.000Z",
  isCurrent: true,
};

export const MOCK_DOCUMENT_DETAIL: z.infer<typeof documentDetailSchema> = {
  ...MOCK_DOCUMENT,
  metadata: { author: "Sari Dewi", documentCreatedAt: "2026-03-04T00:00:00.000Z" },
  versions: [MOCK_VERSION],
};

export const MOCK_CLASSIFIED_DOCUMENT: z.infer<typeof classifiedDocumentSchema> = {
  ...MOCK_DOCUMENT_DETAIL,
  confirmedAt: "2026-09-10T05:02:31.000Z",
  confirmedBy: MOCK_UPLOADER,
};

export const MOCK_UPLOAD_BATCH: z.infer<typeof uploadBatchSchema> = {
  accepted: 1,
  rejected: 0,
  summary: null,
  results: [
    {
      index: 0,
      filename: "laporan-q3.pdf",
      status: "accepted",
      document: {
        id: DOC_ID,
        title: "laporan-q3.pdf",
        processingState: "queued",
        processingLabel: "Antre",
      },
    },
  ],
};

export const MOCK_BULK_TICKET: z.infer<typeof bulkDownloadTicketSchema> = {
  ticketId: TICKET_ID,
  downloadUrl: `/api/v1/documents/download-bulk/${TICKET_ID}`,
  expiresAt: "2026-09-10T04:35:00.000Z",
  includedCount: 1,
  omittedCount: 0,
  omitted: [],
  message: null,
};

export const MOCK_PROCESSING: z.infer<typeof processingStatusSchema> = {
  documentId: DOC_ID,
  state: "ready",
  label: "Siap",
  failureReason: null,
  searchable: true,
  updatedAt: "2026-09-10T05:20:44.000Z",
};

export const MOCK_REPROCESS: z.infer<typeof reprocessAcceptedSchema> = {
  documentId: DOC_ID,
  state: "queued",
  label: "Antre",
};

export const MOCK_TOP_TAG: z.infer<typeof topTagSchema> = { tag: "strategy", documentCount: 42 };

export const MOCK_TITLE_HIT: z.infer<typeof titleHitSchema> = {
  documentId: DOC_ID,
  title: "kontrak-kerjasama.pdf",
  fileType: "pdf",
  fragment: "kontrak <em>kerjasama</em> antara PT Contoh Baru dan ...",
  uploader: MOCK_UPLOADER,
  category: { id: CATEGORY_ID, name: "Technical Spec" },
  createdAt: "2026-09-01T09:00:00.000Z",
  score: 8.42,
};

export const MOCK_CONTENT_HIT: z.infer<typeof contentHitSchema> = {
  documentId: DOC_ID,
  title: "kontrak-kerjasama.pdf",
  fileType: "pdf",
  pageNumber: 15,
  fragment: "... tunduk pada <em>klausul-kerahasiaan</em> sebagaimana diatur ...",
  matchCount: 3,
  uploader: MOCK_UPLOADER,
  score: 12.07,
};

export const MOCK_RELATED: z.infer<typeof relatedDocumentSchema> = {
  documentId: "3c7e5b21-9a04-4d18-b6f2-8e0a1c2d3e4f",
  title: "technical-proposal-test.pdf",
  fileType: "pdf",
  uploader: MOCK_UPLOADER,
  sharedCategory: true,
  sharedTags: ["legal"],
  score: 4.11,
};

export const MOCK_AUDIT_EVENT: z.infer<typeof auditEventSchema> = {
  id: "10241",
  action: "document.download",
  actionLabel: "Unduhan ditolak",
  outcome: "denied",
  actor: { id: USER_ID, name: "Zayd Almasi" },
  subject: { type: "document", id: DOC_ID, title: "offering-letter.pdf" },
  metadata: { reason: "DOWNLOAD_FORBIDDEN" },
  createdAt: "2026-09-10T05:41:12.000Z",
};

export const MOCK_DASHBOARD: z.infer<typeof analyticsDashboardSchema> = {
  volume: { totalDocuments: 412, uploadedLast7Days: 23 },
  retrieval: { searchesLast7Days: 187, zeroResultRatePercent: 12.3, documentsOpenedLast7Days: 96 },
  aiQuality: { categoryOverrideRatePercent: 8.1, fieldOverrideRatePercent: 4.7, sampleSize: 149 },
  generatedAt: "2026-09-10T06:00:00.000Z",
  message: null,
};

export const listOf = <T>(item: T) => page([item], { page: 1, limit: 10, total: 1, totalPages: 1 });
