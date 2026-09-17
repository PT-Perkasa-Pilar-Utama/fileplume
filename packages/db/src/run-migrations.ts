import { join } from "node:path";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import type { Db } from "./create-db.ts";

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: join(import.meta.dir, "migrations") });
}
