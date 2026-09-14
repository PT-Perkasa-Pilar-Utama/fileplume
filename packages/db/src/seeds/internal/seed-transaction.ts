import type { Db } from "../../client.ts";

/**
 * The handle both seed writers take. A seed runs inside one transaction, so a
 * run that fails partway leaves nothing half-written for the next one to trip
 * over. Derived from the client rather than imported from drizzle internals.
 */
export type SeedTx = Parameters<Parameters<Db["transaction"]>[0]>[0];
