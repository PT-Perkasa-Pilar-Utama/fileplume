import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Db } from "@archiva/db";
import { schema } from "@archiva/db";
import { asTenantId, asUserId, asVersionId } from "@archiva/shared";
import { createDrizzleCatalogRepository } from "../../repository.ts";
import { startTestDatabase } from "../test-database.ts";
import { createDrizzleProcessingRepository } from "./repository.ts";

describe("version-guarded processing repository", () => {
  let db: Db;
  let stop: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    const started = await startTestDatabase();
    db = started.db;
    stop = started.stop;
  }, 120_000);
  afterAll(async () => {
    await stop?.();
  });

  async function fixture() {
    const tenantId = asTenantId(crypto.randomUUID());
    const uploaderId = asUserId(crypto.randomUUID());
    await db.insert(schema.tenants).values({ id: tenantId, name: tenantId, subdomain: tenantId });
    await db.insert(schema.users).values({
      id: uploaderId,
      tenantId,
      name: "Worker test",
      email: `${uploaderId}@example.test`,
      passwordHash: "fixture",
    });
    const catalog = createDrizzleCatalogRepository(db);
    const created = await catalog.insertDocumentWithVersion(tenantId, {
      uploaderId,
      filename: "test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1,
      contentHash: "a".repeat(64),
      blobKey: "isolated",
    });
    if (!created.ok) throw new Error("Fixture insert failed");
    const documentId = created.value.id;
    const doc = await catalog.findDocumentForProcessing(tenantId, documentId);
    if (!doc) throw new Error("Fixture missing");
    return {
      tenantId,
      uploaderId,
      documentId,
      versionId: doc.currentVersionId,
      catalog,
      processing: createDrizzleProcessingRepository(db),
    };
  }

  test("only one concurrent claim wins", async () => {
    const f = await fixture();
    const results = await Promise.all(
      [1, 2].map(() => f.processing.claimVersion(f.tenantId, f.documentId, f.versionId)),
    );
    expect(results.sort()).toEqual([false, true]);
  });

  test("cross-tenant and wrong-version claims cannot change state", async () => {
    const f = await fixture();
    expect(
      await f.processing.claimVersion(asTenantId(crypto.randomUUID()), f.documentId, f.versionId),
    ).toBe(false);
    expect(
      await f.processing.claimVersion(f.tenantId, f.documentId, asVersionId(crypto.randomUUID())),
    ).toBe(false);
    expect((await f.catalog.findDocument(f.tenantId, f.documentId))?.processingState).toBe(
      "queued",
    );
  });

  test("a superseding version rejects both stale success and failure", async () => {
    const f = await fixture();
    await f.processing.claimVersion(f.tenantId, f.documentId, f.versionId);
    const added = await f.catalog.insertVersionAndUpdateDocument(f.tenantId, {
      documentId: f.documentId,
      uploaderId: f.uploaderId,
      filename: "v2.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2,
      contentHash: "b".repeat(64),
      blobKey: "isolated-v2",
    });
    expect(added.ok).toBe(true);
    expect(
      await f.processing.finishVersion(f.tenantId, f.documentId, f.versionId, { state: "ready" }),
    ).toBe(false);
    expect(
      await f.processing.finishVersion(f.tenantId, f.documentId, f.versionId, {
        state: "failed",
        reason: "index_failed",
      }),
    ).toBe(false);
    expect((await f.catalog.findDocument(f.tenantId, f.documentId))?.processingState).toBe(
      "queued",
    );
  });

  test("recovery cursor includes tenant and document ordering", async () => {
    const first = await fixture();
    const second = await fixture();
    const processing = createDrizzleProcessingRepository(db);
    const all = await processing.listRecoverableDocuments(100);
    expect(all.some((row) => row.documentId === first.documentId)).toBe(true);
    expect(all.some((row) => row.documentId === second.documentId)).toBe(true);
    for (let index = 0; index < all.length - 1; index++) {
      const current = all[index];
      const expected = all[index + 1];
      if (!current || !expected) throw new Error("Missing recovery row");
      const next = await processing.listRecoverableDocuments(1, current);
      expect(next[0]).toEqual(expected);
    }
  });

  test("terminal rows reject a late completion and recovery finds queued documents only", async () => {
    const f = await fixture();
    await f.processing.claimVersion(f.tenantId, f.documentId, f.versionId);
    expect(
      await f.processing.finishVersion(f.tenantId, f.documentId, f.versionId, { state: "ready" }),
    ).toBe(true);
    expect(
      await f.processing.finishVersion(f.tenantId, f.documentId, f.versionId, {
        state: "failed",
        reason: "index_failed",
      }),
    ).toBe(false);
    const queued = await fixture();
    const rows = await f.processing.listRecoverableDocuments(20);
    expect(rows.some((row) => row.documentId === f.documentId)).toBe(false);
    expect(rows.some((row) => row.documentId === queued.documentId)).toBe(true);
  });
});
