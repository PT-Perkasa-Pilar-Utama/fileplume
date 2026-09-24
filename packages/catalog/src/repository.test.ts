import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import type { TenantId, UserId } from "@archiva/shared";
import { asTenantId, asUserId } from "@archiva/shared";
import { eq } from "drizzle-orm";
import { startTestDatabase } from "./internal/test-database.ts";
import { createDrizzleCatalogRepository } from "./repository.ts";

/**
 * Real Postgres, real migrations. CODING_STANDARD.md 10.5 — a mocked query
 * proves the mock. This proves that UNIQUE (tenant_id, content_hash) closes
 * the duplicate race at the database level, not via a read-then-check.
 */
describe("createDrizzleCatalogRepository", () => {
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
        name: `Catalog Test ${slug}`,
        subdomain: `cat-${slug}`,
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
        name: "Catalog User",
      })
      .returning({ id: schema.users.id });
    if (!row) throw new Error("seedUser: insert returned no row");
    return asUserId(row.id);
  }

  test("AC-03.01: duplicate content insert is rejected with DuplicateContent and existingDocumentId", async () => {
    const repository = createDrizzleCatalogRepository(db);
    const tenantId = await seedTenant();
    const uploaderId = await seedUser(tenantId);
    const contentHash = "a".repeat(64);

    const first = await repository.insertDocumentWithVersion(tenantId, {
      uploaderId,
      contentHash,
      blobKey: "t/1/d/1/v/1",
      filename: "laporan-keuangan.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await repository.insertDocumentWithVersion(tenantId, {
      uploaderId,
      contentHash,
      blobKey: "t/1/d/2/v/1",
      filename: "salinan.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.kind).toBe("DuplicateContent");
    expect(second.error.existingDocumentId).toBe(first.value.id);
  });

  test("AC-03.04: two simultaneous identical uploads race on insert: exactly one succeeds", async () => {
    // 06-data-model.md 6.6, AC-03.04: Decided by UNIQUE (tenant_id, content_hash)
    // so the loser fails on insert rather than on a read-then-check.
    const repository = createDrizzleCatalogRepository(db);
    const tenantId = await seedTenant();
    const uploaderId = await seedUser(tenantId);
    const contentHash = "b".repeat(64);

    const [first, second] = await Promise.all([
      repository.insertDocumentWithVersion(tenantId, {
        uploaderId,
        contentHash,
        blobKey: "t/1/d/a/v/1",
        filename: "berkas-a.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
      }),
      repository.insertDocumentWithVersion(tenantId, {
        uploaderId,
        contentHash,
        blobKey: "t/1/d/b/v/1",
        filename: "berkas-b.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
      }),
    ]);

    const successes = [first, second].filter((r) => r.ok);
    const failures = [first, second].filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const winner = successes[0];
    const loser = failures[0];
    if (!winner?.ok || !loser || loser.ok) return;

    expect(loser.error.kind).toBe("DuplicateContent");
    expect(loser.error.existingDocumentId).toBe(winner.value.id);

    // Verify PostgreSQL state: exactly one version and one document exist
    const versions = await db
      .select()
      .from(schema.documentVersions)
      .where(eq(schema.documentVersions.tenantId, tenantId));
    expect(versions).toHaveLength(1);

    const docs = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.tenantId, tenantId));
    expect(docs).toHaveLength(1);
  });

  test("cross-tenant isolation: identical content in different tenants both succeed", async () => {
    const repository = createDrizzleCatalogRepository(db);
    const tenantA = await seedTenant();
    const tenantB = await seedTenant();
    const userA = await seedUser(tenantA);
    const userB = await seedUser(tenantB);
    const contentHash = "c".repeat(64);

    const resA = await repository.insertDocumentWithVersion(tenantA, {
      uploaderId: userA,
      contentHash,
      blobKey: "t/a/d/1/v/1",
      filename: "doc-a.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
    });

    const resB = await repository.insertDocumentWithVersion(tenantB, {
      uploaderId: userB,
      contentHash,
      blobKey: "t/b/d/1/v/1",
      filename: "doc-b.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
    });

    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);
  });

  test("deleteDocument removes document and versions atomically", async () => {
    const repository = createDrizzleCatalogRepository(db);
    const tenantId = await seedTenant();
    const uploaderId = await seedUser(tenantId);
    const contentHash = "d".repeat(64);

    const inserted = await repository.insertDocumentWithVersion(tenantId, {
      uploaderId,
      contentHash,
      blobKey: "t/x/d/1/v/1",
      filename: "hapus.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });
    expect(inserted.ok).toBe(true);
    if (!inserted.ok) return;

    await repository.deleteDocument(tenantId, inserted.value.id);

    const doc = await repository.findDocument(tenantId, inserted.value.id);
    expect(doc).toBeNull();

    const versions = await db
      .select()
      .from(schema.documentVersions)
      .where(eq(schema.documentVersions.documentId, inserted.value.id));
    expect(versions).toHaveLength(0);
  });
});
