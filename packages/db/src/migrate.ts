import { join } from "node:path";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { db, sql } from "./client.ts";

/**
 * The migrations folder is resolved relative to this module, not an absolute
 * path: a hardcoded path cannot be found inside a slim image. Applied through
 * the ledger, never by exec-ing a raw .sql file.
 * technical-specs/06-data-model.md 6.11.
 */
await migrate(db, { migrationsFolder: join(import.meta.dir, "migrations") });
await sql.close();
