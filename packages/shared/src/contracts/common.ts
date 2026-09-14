import { z } from "zod";
import { paginationQuery } from "../envelope.ts";

/** ISO 8601 UTC. api-specs/01-conventions.md. */
export const timestampSchema = z.iso.datetime();

export const personRefSchema = z
  .object({ id: z.uuid(), name: z.string() })
  .meta({ id: "PersonRef" });

export const idParams = z.object({ id: z.uuid() });

/** 1.5. `sort` is enumerated per operation; a free field name is rejected. */
export const sortableQuery = <const S extends readonly [string, ...string[]]>(
  sorts: S,
  sort: S[number],
  order: "asc" | "desc",
) =>
  paginationQuery.extend({
    sort: z.enum(sorts).default(sort),
    order: z.enum(["asc", "desc"]).default(order),
  });

/**
 * A parameter that may repeat, `?tags=a&tags=b`. The query validator yields a
 * string for one occurrence and an array for several; handlers always see an array.
 */
export const repeatedQuery = <T extends z.ZodType<string>>(item: T) =>
  z.union([item, z.array(item)]).transform((value) => (Array.isArray(value) ? value : [value]));

export const booleanQuery = z.enum(["true", "false"]).transform((value) => value === "true");
