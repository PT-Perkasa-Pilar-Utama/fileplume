import type { SeedDocument } from "./dev-documents.ts";
import type { SeedCategory, SeedUser } from "./dev-tenant.ts";

/**
 * A second tenant, so the cross-tenant criteria have something to point at.
 * AC-43.03 and AC-43.04 name `rahasia-b.pdf` as belonging to Tenant B, and a
 * 404 that proves isolation needs a real id in another tenant to ask for.
 * The dev set stays one tenant, as 06-data-model.md 6.11 specifies.
 */
export const QA_TENANT_B = {
  name: "PT Mitra Rahasia",
  subdomain: "mitra-rahasia",
} as const;

export const QA_TENANT_B_ADMIN_EMAIL = "admin@mitra-rahasia.test";

export const QA_TENANT_B_USERS: SeedUser[] = [
  { email: QA_TENANT_B_ADMIN_EMAIL, name: "Rina Kusuma", role: "admin_tenant" },
  { email: "anggota@mitra-rahasia.test", name: "Joko Santoso", role: "member" },
];

export const QA_TENANT_B_CATEGORIES: SeedCategory[] = [
  { name: "Uncategorized", isSystem: true, downloadActive: false },
  { name: "Rahasia", isSystem: false, downloadActive: true },
];

export const QA_TENANT_B_DOCUMENTS: SeedDocument[] = [
  {
    // AC-43.03 and AC-43.04: a Tenant A caller asking for this id gets 404.
    key: "rahasia-b.pdf",
    title: "rahasia-b.pdf",
    uploaderEmail: QA_TENANT_B_ADMIN_EMAIL,
    mimeType: "application/pdf",
    sizeBytes: 133_120,
    state: "ready",
    ageDays: 40,
    category: "Rahasia",
    confirmed: true,
    confidence: "0.900",
    author: "Rina Kusuma",
    tags: ["rahasia"],
    pages: ["Dokumen rahasia milik Tenant B yang tidak boleh bocor ke tenant lain."],
  },
  {
    key: "kontrak-internal-b.pdf",
    title: "kontrak-internal-b.pdf",
    uploaderEmail: "anggota@mitra-rahasia.test",
    mimeType: "application/pdf",
    sizeBytes: 157_696,
    state: "ready",
    ageDays: 35,
    category: "Rahasia",
    confirmed: true,
    confidence: "0.850",
    author: "Joko Santoso",
    tags: ["kontrak"],
    pages: ["Kontrak internal Tenant B."],
  },
];
