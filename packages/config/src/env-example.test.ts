import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { parseConfig } from "./load-config.ts";
import { CONFIG_KEYS } from "./schema.ts";

const ENTRY = /^([A-Z][A-Z0-9_]*)=(.*)$/;

async function readEnvExample(): Promise<Record<string, string>> {
  const text = await Bun.file(join(import.meta.dir, "../../../.env.example")).text();
  const example: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = ENTRY.exec(line);
    if (match?.[1] !== undefined) example[match[1]] = match[2] ?? "";
  }
  return example;
}

describe(".env.example, 11.8 rule 1", () => {
  test("lists every key the schema reads", async () => {
    const example = await readEnvExample();
    expect(CONFIG_KEYS.filter((key) => !(key in example))).toEqual([]);
  });

  test("boots as copied, so `cp .env.example .env` works", async () => {
    const result = parseConfig(await readEnvExample());
    expect(result.ok ? [] : result.error).toEqual([]);
  });
});
