import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { DocumentId, TenantId, UserId } from "@archiva/shared";
import { asTenantId, asUserId } from "@archiva/shared";
import { startTestDatabase } from "./internal/test-database.ts";
import { createDrizzleCatalogRepository } from "./repository.ts";

/**
 * Real Postgres, real migrations. CODING_STANDARD.md 10.5 — a mocked query
 * proves the mock. Proves that the version allocation race is closed at the
 * database via SELECT ... FOR UPDATE, not just in the in-memory model of it.
 */
describe("createDrizzleCatalogRepository versioning", () => {
  let db: Db;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    const started = await startTestDatabase();
    db = started.db;
    stop = started.stop;
  }, 120_000);

  afterAll(async () => {
    await stop();
  });

  async function seedTenant(): Promise<TenantId> {
    const slug = crypto.randomUUID().slice(0, 8);
    const [row] = await db
      .insert(schema.tenants)
      .values({
        name: `Tenant ${slug}`,
        subdomain: `test-${slug}`,
        storageQuotaBytes: 10_000_000,
      })
      .returning({ id: schema.tenants.id });
    if (!row) throw new Error("seedTenant: insert returned no row");
    return asTenantId(row.id);
  }

  async function seedUser(tenantId: TenantId): Promise<UserId> {
    const [row] = await db
      .insert(schema.users)
      .values({
        tenantId,
        email: `${crypto.randomUUID()}@example.test`,
        passwordHash: "not-a-real-hash",
        name: "Test User",
      })
      .returning({ id: schema.users.id });
    if (!row) throw new Error("seedUser: insert returned no row");
    return asUserId(row.id);
  }

  async function seedDocument(
    repository: ReturnType<typeof createDrizzleCatalogRepository>,
    tenantId: TenantId,
    uploaderId: UserId,
    hash = "1111111111111111111111111111111111111111111111111111111111111111",
  ): Promise<DocumentId> {
    const res = await repository.insertDocumentWithVersion(tenantId, {
      uploaderId,
      filename: "dokumen.pdf",
      contentHash: hash,
      mimeType: "application/pdf",
      sizeBytes: 1000,
      blobKey: `t/${tenantId}/d/seed/v/1`,
    });
    if (!res.ok) throw new Error("seedDocument failed");
    return res.value.id;
  }

  test("AC-21.04: two concurrent version uploads receive consecutive version numbers via row lock", async () => {
    const repository = createDrizzleCatalogRepository(db);
    const tenantId = await seedTenant();
    const uploaderId = await seedUser(tenantId);
    const documentId = await seedDocument(repository, tenantId, uploaderId);

    const hashA = "2222222222222222222222222222222222222222222222222222222222222222";
    const hashB = "3333333333333333333333333333333333333333333333333333333333333333";

    const [resA, resB] = await Promise.all([
      repository.insertVersionAndUpdateDocument(tenantId, {
        documentId,
        uploaderId,
        filename: "revisi-a.pdf",
        contentHash: hashA,
        mimeType: "application/pdf",
        sizeBytes: 2000,
        blobKey: `t/${tenantId}/d/${documentId}/v/a`,
      }),
      repository.insertVersionAndUpdateDocument(tenantId, {
        documentId,
        uploaderId,
        filename: "revisi-b.pdf",
        contentHash: hashB,
        mimeType: "application/pdf",
        sizeBytes: 3000,
        blobKey: `t/${tenantId}/d/${documentId}/v/b`,
      }),
    ]);

    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);
    if (!resA.ok || !resB.ok) return;

    const numbers = [resA.value.versionNumber, resB.value.versionNumber].sort((a, b) => a - b);
    expect(numbers).toEqual([2, 3]);

    const versions = await repository.listVersions(tenantId, documentId);
    expect(versions).toHaveLength(3);
    expect(versions?.[0]?.versionNumber).toBe(3);
    expect(versions?.[0]?.isCurrent).toBe(true);
  });

  test("AC-21.03: identical content against current version returns IdenticalContent under transaction", async () => {
    const repository = createDrizzleCatalogRepository(db);
    const tenantId = await seedTenant();
    const uploaderId = await seedUser(tenantId);
    const initialHash = "4444444444444444444444444444444444444444444444444444444444444444";
    const documentId = await seedDocument(repository, tenantId, uploaderId, initialHash);

    const res = await repository.insertVersionAndUpdateDocument(tenantId, {
      documentId,
      uploaderId,
      filename: "revisi-sama.pdf",
      contentHash: initialHash,
      mimeType: "application/pdf",
      sizeBytes: 1000,
      blobKey: `t/${tenantId}/d/${documentId}/v/same`,
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe("IdenticalContent");
  });

  test("AC-03.04: content hash matching another document in tenant returns DuplicateContent", async () => {
    const repository = createDrizzleCatalogRepository(db);
    const tenantId = await seedTenant();
    const uploaderId = await seedUser(tenantId);
    const sharedHash = "5555555555555555555555555555555555555555555555555555555555555555";
    const docA = await seedDocument(repository, tenantId, uploaderId, sharedHash);

    const docB = await seedDocument(
      repository,
      tenantId,
      uploaderId,
      "6666666666666666666666666666666666666666666666666666666666666666",
    );

    const res = await repository.insertVersionAndUpdateDocument(tenantId, {
      documentId: docB,
      uploaderId,
      filename: "revisi-duplicate.pdf",
      contentHash: sharedHash,
      mimeType: "application/pdf",
      sizeBytes: 1000,
      blobKey: `t/${tenantId}/d/${docB}/v/dup`,
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe("DuplicateContent");
    if (res.error.kind === "DuplicateContent") {
      expect(res.error.existingDocumentId).toBe(docA);
    }
  });
});
