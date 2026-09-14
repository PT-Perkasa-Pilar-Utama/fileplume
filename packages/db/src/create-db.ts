import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

function connect(client: SQL) {
  return drizzle({ client });
}

export type Db = ReturnType<typeof connect>;
export type DbHandle = { db: Db; client: SQL };

/**
 * A composition root passes the connection settings in, so importing the
 * package never reads the environment. technical-specs/06-data-model.md 6.11.
 */
export function createDb(options: { url: string; max: number }): DbHandle {
  const client = new SQL({ url: options.url, max: options.max });
  return { db: connect(client), client };
}
