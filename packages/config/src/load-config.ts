import { err, ok, type Result } from "@archiva/shared";
import { type Config, schema } from "./schema.ts";

type Env = Record<string, string | undefined>;

/**
 * `KEY=` means absent. An empty secret then fails as missing rather than
 * booting with an empty credential, and an empty optional url stays optional.
 */
function withoutEmptyValues(env: Env): Env {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ""));
}

/** Pure: one `<key>: <reason>` line per problem, or the frozen config. */
export function parseConfig(env: Env): Result<Readonly<Config>, string[]> {
  const parsed = schema.safeParse(withoutEmptyValues(env));
  if (!parsed.success) {
    return err(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }
  return ok(Object.freeze(parsed.data));
}

/**
 * Parsed once at startup. Exits non-zero before the server binds, and nothing
 * re-reads process.env at request time (11.8 rule 3).
 */
export function loadConfig(env: Env = process.env): Readonly<Config> {
  const result = parseConfig(env);
  if (!result.ok) {
    for (const line of result.error) console.error(`config: ${line}`);
    process.exit(1);
  }
  return result.value;
}
