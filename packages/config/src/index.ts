import { z } from "zod";

/**
 * technical-specs/11-environment-configuration.md.
 * Parsed once at startup into a frozen object. Nothing re-reads process.env at
 * request time, so behaviour cannot change under a running process.
 */
const schema = z
  .object({
    APP_ENV: z.enum(["dev", "test", "sit", "uat", "production"]),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().default(3000),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    WEB_ORIGIN: z.url(),
    APP_VERSION: z.string().default("dev"),

    DATABASE_URL: z.url(),
    DATABASE_POOL_MAX: z.coerce.number().int().default(10),
    VALKEY_URL: z.url(),
    OPENSEARCH_URL: z.url(),
    OPENSEARCH_USERNAME: z.string(),
    OPENSEARCH_PASSWORD: z.string(),
    OPENSEARCH_INDEX_PREFIX: z.string(),
    S3_ENDPOINT: z.url(),
    S3_REGION: z.string(),
    S3_BUCKET: z.string(),
    S3_ACCESS_KEY_ID: z.string(),
    S3_SECRET_ACCESS_KEY: z.string(),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),

    CLAMAV_HOST: z.string(),
    CLAMAV_PORT: z.coerce.number().int().default(3310),
    GOTENBERG_URL: z.url(),
    AI_PROVIDER: z.enum(["anthropic", "selfhosted", "stub"]),
    AI_API_KEY: z.string().optional(),
    AI_MODEL_CLASSIFY: z.string().default("claude-sonnet-5"),
    AI_MODEL_TAG: z.string().default("claude-haiku-4-5-20251001"),
    AI_DAILY_TOKEN_BUDGET: z.coerce.number().int().default(1_000_000),
    OCR_PROVIDER: z.enum(["hosted", "tesseract", "fixture"]),
    OCR_API_KEY: z.string().optional(),

    AUTH_SECRET: z.string().min(32),
    SESSION_ABSOLUTE_TTL_DAYS: z.coerce.number().int().default(30),
    SESSION_IDLE_TTL_HOURS: z.coerce.number().int().default(8),
    // No COOKIE_DOMAIN: the __Host- prefix forbids a Domain attribute, and a
    // browser silently rejects a __Host- cookie that carries one.

    ENABLE_RESET_API: z.coerce.boolean().default(false),
    RESET_API_TOKEN: z.string().optional(),
    RESET_DEFAULT_SEED: z.enum(["dev", "qa"]).optional(),
    HEALTH_TOKEN: z.string(),

    WORKER_CONCURRENCY: z.coerce.number().int().default(4),
    WORKER_MAX_ATTEMPTS: z.coerce.number().int().default(3),
    WORKER_BACKOFF_MS: z.coerce.number().int().default(5000),
  })
  // 11.5 layer 2: a misconfigured production deploy does not boot, rather than
  // booting dangerously.
  .refine((c) => !(c.APP_ENV === "production" && c.ENABLE_RESET_API), {
    message: "ENABLE_RESET_API must not be set when APP_ENV=production",
    path: ["ENABLE_RESET_API"],
  })
  .refine((c) => !(c.APP_ENV === "production" && c.RESET_API_TOKEN), {
    message: "RESET_API_TOKEN must not be set when APP_ENV=production",
    path: ["RESET_API_TOKEN"],
  })
  .refine((c) => !(c.APP_ENV === "production" && c.AI_PROVIDER === "stub"), {
    message: "AI_PROVIDER=stub is rejected in production",
    path: ["AI_PROVIDER"],
  })
  .refine((c) => c.AI_PROVIDER === "stub" || Boolean(c.AI_API_KEY), {
    message: "AI_API_KEY is required unless AI_PROVIDER=stub",
    path: ["AI_API_KEY"],
  })
  .refine((c) => c.OCR_PROVIDER !== "hosted" || Boolean(c.OCR_API_KEY), {
    message: "OCR_API_KEY is required when OCR_PROVIDER=hosted",
    path: ["OCR_API_KEY"],
  });

export type Config = z.infer<typeof schema>;

/** Exits non-zero before the server binds. Never a silent fallback. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      console.error(`config: ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return Object.freeze(parsed.data);
}

/** The secret keys the pino serialiser redacts. 11.7 rule 5. */
export const SECRET_KEYS = [
  "DATABASE_URL",
  "VALKEY_URL",
  "OPENSEARCH_PASSWORD",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "AI_API_KEY",
  "OCR_API_KEY",
  "AUTH_SECRET",
  "RESET_API_TOKEN",
  "HEALTH_TOKEN",
] as const;
