import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseConfig } from "./load-config.ts";

const VALID_ENV = {
  APP_ENV: "dev",
  WEB_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgres://archiva:archiva@localhost:5432/archiva",
  VALKEY_URL: "redis://localhost:6379",
  OPENSEARCH_URL: "http://localhost:9200",
  OPENSEARCH_USERNAME: "admin",
  OPENSEARCH_PASSWORD: "secret",
  OPENSEARCH_INDEX_PREFIX: "archiva-dev",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "archiva",
  S3_ACCESS_KEY_ID: "archiva",
  S3_SECRET_ACCESS_KEY: "archiva-secret",
  CLAMAV_HOST: "localhost",
  GOTENBERG_URL: "http://localhost:3001",
  AI_PROVIDER: "stub",
  OCR_PROVIDER: "fixture",
  AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  HEALTH_TOKEN: "dev-health-token",
};

const PRODUCTION_ENV = {
  ...VALID_ENV,
  APP_ENV: "production",
  AI_PROVIDER: "anthropic",
  AI_API_KEY: "sk-test",
};

function issuesFor(env: Record<string, string>): string[] {
  const result = parseConfig(env);
  return result.ok ? [] : result.error;
}

function refuses(env: Record<string, string>, key: string): boolean {
  return issuesFor(env).some((line) => line.startsWith(`${key}:`));
}

describe("parseConfig", () => {
  test("accepts a complete environment and freezes the result", () => {
    const result = parseConfig(VALID_ENV);
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.isFrozen(result.value)).toBe(true);
  });

  test("refuses a missing required key", () => {
    const { DATABASE_URL: _, ...env } = VALID_ENV;
    expect(refuses(env, "DATABASE_URL")).toBe(true);
  });

  test("treats an empty secret as missing", () => {
    // 11.8 rule 2: never a silent fallback to an empty credential.
    expect(refuses({ ...VALID_ENV, OPENSEARCH_PASSWORD: "" }, "OPENSEARCH_PASSWORD")).toBe(true);
  });

  test.each([
    ["PORT", "abc"],
    ["PORT", "0"],
    ["WEB_ORIGIN", "not-a-url"],
    ["S3_FORCE_PATH_STYLE", "maybe"],
    ["OTEL_TRACES_SAMPLER_ARG", "1.5"],
  ])("refuses malformed %s=%s", (key, value) => {
    expect(refuses({ ...VALID_ENV, [key]: value }, key)).toBe(true);
  });

  test("reads the string false as false", () => {
    const result = parseConfig({ ...VALID_ENV, S3_FORCE_PATH_STYLE: "false" });
    expect(result.ok && result.value.S3_FORCE_PATH_STYLE).toBe(false);
  });

  test("an empty optional url stays absent", () => {
    const result = parseConfig({ ...VALID_ENV, OTEL_EXPORTER_OTLP_ENDPOINT: "" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
  });

  test("AI_API_KEY is required unless the provider is stub", () => {
    expect(refuses({ ...VALID_ENV, AI_PROVIDER: "anthropic" }, "AI_API_KEY")).toBe(true);
  });

  test("OCR_API_KEY is required when the provider is hosted", () => {
    expect(refuses({ ...VALID_ENV, OCR_PROVIDER: "hosted" }, "OCR_API_KEY")).toBe(true);
  });
});

describe("production refusals, 11.5 layer 2", () => {
  test("boots with neither reset variable set", () => {
    expect(issuesFor(PRODUCTION_ENV)).toEqual([]);
  });

  test.each([
    ["ENABLE_RESET_API", "true"],
    ["ENABLE_RESET_API", "false"],
    ["RESET_API_TOKEN", "leaked-token"],
  ])("refuses %s=%s", (key, value) => {
    expect(refuses({ ...PRODUCTION_ENV, [key]: value }, key)).toBe(true);
  });

  test("refuses the stub AI provider", () => {
    expect(refuses({ ...PRODUCTION_ENV, AI_PROVIDER: "stub" }, "AI_PROVIDER")).toBe(true);
  });
});

describe("loadConfig", () => {
  test("exits non-zero and names the offending key", async () => {
    // A temp cwd, because Bun auto-loads .env from the working directory.
    const moduleUrl = pathToFileURL(join(import.meta.dir, "load-config.ts")).href;
    const proc = Bun.spawn(
      [process.execPath, "-e", `import(${JSON.stringify(moduleUrl)}).then((m) => m.loadConfig())`],
      {
        cwd: mkdtempSync(join(tmpdir(), "archiva-config-")),
        env: { ...PRODUCTION_ENV, ENABLE_RESET_API: "true", SystemRoot: process.env.SystemRoot },
        stderr: "pipe",
      },
    );
    const [exitCode, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("config: ENABLE_RESET_API: ");
  });
});
