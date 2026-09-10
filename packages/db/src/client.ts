import { loadConfig } from "@archiva/config";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

/**
 * The connection string comes from the environment through packages/config,
 * never from a literal. technical-specs/06-data-model.md 6.11.
 */
const config = loadConfig();

export const sql = new SQL({ url: config.DATABASE_URL, max: config.DATABASE_POOL_MAX });
export const db = drizzle({ client: sql });
export type Db = typeof db;
