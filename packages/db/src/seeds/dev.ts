import type { Db } from "../create-db.ts";
import { DEV_DOCUMENTS } from "./internal/dev-documents.ts";
import {
  DEV_ADMIN_EMAIL,
  DEV_CATEGORIES,
  DEV_CONFIG,
  DEV_PASSWORD,
  DEV_SESSIONS,
  DEV_TENANT,
  DEV_USERS,
} from "./internal/dev-tenant.ts";
import { writeDocuments } from "./internal/write-documents.ts";
import { writeSessions } from "./internal/write-sessions.ts";
import { writeTenancy } from "./internal/write-tenancy.ts";

/**
 * Idempotent: running twice leaves the same state, and running against a
 * partially seeded database completes it rather than failing on a conflict.
 * Every insert is an upsert keyed on a stable natural key.
 * technical-specs/06-data-model.md 6.11.
 *
 * Rows only. The reset sequence purges the blob prefix and recreates the
 * search index after this runs (05-module-definitions.md 5.8.2), so a seeded
 * document's `blob_key` addresses bytes nothing holds and nothing here is
 * searchable. Fixtures that have to survive the pipeline are files under
 * `fixtures/`, uploaded by the test that needs them.
 */
export async function seedDev(
  db: Db,
  options?: { sessionAbsoluteTtlDays?: number },
): Promise<void> {
  const passwordHash = await Bun.password.hash(DEV_PASSWORD, "argon2id");

  await db.transaction(async (tx) => {
    const ids = await writeTenancy(tx, {
      tenant: DEV_TENANT,
      users: DEV_USERS,
      passwordHash,
      config: DEV_CONFIG,
      categories: DEV_CATEGORIES,
      adminEmail: DEV_ADMIN_EMAIL,
    });

    await writeDocuments(tx, {
      tenantId: ids.tenantId,
      tenantSubdomain: DEV_TENANT.subdomain,
      userIdByEmail: ids.userIdByEmail,
      categoryIdByName: ids.categoryIdByName,
      documents: DEV_DOCUMENTS,
    });

    await writeSessions(tx, {
      sessions: DEV_SESSIONS,
      userIdByEmail: ids.userIdByEmail,
      absoluteTtlDays: options?.sessionAbsoluteTtlDays ?? 30,
    });
  });
}

if (import.meta.main) {
  const { loadConfig } = await import("@archiva/config");
  const { sql: connection, db } = await import("../client.ts");
  const config = loadConfig();
  await seedDev(db, { sessionAbsoluteTtlDays: config.SESSION_ABSOLUTE_TTL_DAYS });
  await connection.close();
}
