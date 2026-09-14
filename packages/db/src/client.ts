import { loadConfig } from "@archiva/config";
import { createDb } from "./create-db.ts";

/**
 * The runner and seed scripts' connection. The connection string comes from
 * the environment through packages/config, never from a literal.
 * technical-specs/06-data-model.md 6.11.
 */
const config = loadConfig();

export const { db, client: sql } = createDb({
  url: config.DATABASE_URL,
  max: config.DATABASE_POOL_MAX,
});
export type { Db } from "./create-db.ts";
