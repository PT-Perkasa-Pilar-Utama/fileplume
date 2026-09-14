import { join } from "node:path";
import type { Db } from "@archiva/db";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

/**
 * Test-only bootstrap: a real Postgres in a container, migrated through the
 * same ledger the runner applies in every environment.
 * CODING_STANDARD.md 10.5 — a mocked query proves the mock, not the schema.
 * Not exported past this module: only repository.test.ts uses it.
 */
export async function startTestDatabase(): Promise<{ db: Db; stop: () => Promise<void> }> {
  const container = await new PostgreSqlContainer("postgres:17").start();
  const sql = new SQL({ url: container.getConnectionUri() });
  const db: Db = drizzle({ client: sql });

  const dbEntry = Bun.resolveSync("@archiva/db", import.meta.dir);
  await migrate(db, { migrationsFolder: join(dbEntry, "..", "migrations") });

  return {
    db,
    async stop() {
      await sql.close();
      await container.stop();
    },
  };
}
