import { sql as connection, db } from "../client.ts";
import { seedDev } from "./dev.ts";
import { DEV_PASSWORD } from "./internal/dev-tenant.ts";
import {
  QA_TENANT_B,
  QA_TENANT_B_ADMIN_EMAIL,
  QA_TENANT_B_CATEGORIES,
  QA_TENANT_B_DOCUMENTS,
  QA_TENANT_B_USERS,
} from "./internal/qa-dataset.ts";
import { writeDocuments } from "./internal/write-documents.ts";
import { writeTenancy } from "./internal/write-tenancy.ts";

/**
 * The dev set plus what QA needs on top of it: a second tenant holding
 * `rahasia-b.pdf`, so the cross-tenant 404 in AC-43.03 and AC-43.04 has a real
 * id to ask for.
 *
 * The fixtures the criteria name by filename are files, not rows, and live
 * under `fixtures/`. Each is uploaded by the test that needs it: AC-01.06 and
 * AC-46.02 are negative paths where the file must never reach the database,
 * and AC-06.01 and AC-33.01 need the pipeline to have run. See
 * `fixtures/README.md`.
 */
export async function seedQa(): Promise<void> {
  await seedDev();
  const passwordHash = await Bun.password.hash(DEV_PASSWORD, "argon2id");

  await db.transaction(async (tx) => {
    const ids = await writeTenancy(tx, {
      tenant: QA_TENANT_B,
      users: QA_TENANT_B_USERS,
      passwordHash,
      config: [],
      categories: QA_TENANT_B_CATEGORIES,
      adminEmail: QA_TENANT_B_ADMIN_EMAIL,
    });

    await writeDocuments(tx, {
      tenantId: ids.tenantId,
      tenantSubdomain: QA_TENANT_B.subdomain,
      userIdByEmail: ids.userIdByEmail,
      categoryIdByName: ids.categoryIdByName,
      documents: QA_TENANT_B_DOCUMENTS,
    });
  });
}

if (import.meta.main) {
  await seedQa();
  await connection.close();
}
