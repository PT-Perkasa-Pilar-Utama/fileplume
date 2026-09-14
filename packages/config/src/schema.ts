import { z } from "zod";

const positiveInt = () => z.coerce.number().int().positive();

/**
 * technical-specs/11-environment-configuration.md 11.1 to 11.7.
 * Secrets carry no default: a missing secret is a startup failure (11.8 rule 2).
 */
export const schema = z
  .object({
    APP_ENV: z.enum(["dev", "test", "sit", "uat", "production"]),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    WEB_ORIGIN: z.url(),
    APP_VERSION: z.string().default("dev"),

    DATABASE_URL: z.url(),
    DATABASE_POOL_MAX: positiveInt().default(10),
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
    S3_FORCE_PATH_STYLE: z.stringbool().default(false),

    CLAMAV_HOST: z.string(),
    CLAMAV_PORT: z.coerce.number().int().min(1).max(65_535).default(3310),
    GOTENBERG_URL: z.url(),
    AI_PROVIDER: z.enum(["anthropic", "selfhosted", "stub"]),
    AI_API_KEY: z.string().optional(),
    AI_MODEL_CLASSIFY: z.string().default("claude-sonnet-5"),
    AI_MODEL_TAG: z.string().default("claude-haiku-4-5-20251001"),
    AI_DAILY_TOKEN_BUDGET: positiveInt().default(1_000_000),
    OCR_PROVIDER: z.enum(["hosted", "tesseract", "fixture"]),
    OCR_API_KEY: z.string().optional(),

    AUTH_SECRET: z.string().min(32),
    SESSION_ABSOLUTE_TTL_DAYS: positiveInt().default(30),
    SESSION_IDLE_TTL_HOURS: positiveInt().default(8),
    // No COOKIE_DOMAIN: the __Host- prefix forbids a Domain attribute, and a
    // browser silently rejects a __Host- cookie that carries one.

    // No default: absent and "false" are different facts in production.
    ENABLE_RESET_API: z.stringbool().optional(),
    RESET_API_TOKEN: z.string().optional(),
    RESET_DEFAULT_SEED: z.enum(["dev", "qa"]).optional(),
    HEALTH_TOKEN: z.string(),

    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    OTEL_SERVICE_NAME: z.string().optional(),
    OTEL_TRACES_SAMPLER_ARG: z.coerce.number().min(0).max(1).default(1),

    WORKER_CONCURRENCY: positiveInt().default(4),
    WORKER_MAX_ATTEMPTS: positiveInt().default(3),
    WORKER_BACKOFF_MS: positiveInt().default(5000),
  })
  // 11.5 layer 2: a misconfigured production deploy does not boot, rather than
  // booting dangerously.
  .refine((c) => !(c.APP_ENV === "production" && c.ENABLE_RESET_API !== undefined), {
    message: "ENABLE_RESET_API must not be set when APP_ENV=production",
    path: ["ENABLE_RESET_API"],
  })
  .refine((c) => !(c.APP_ENV === "production" && c.RESET_API_TOKEN !== undefined), {
    message: "RESET_API_TOKEN must not be set when APP_ENV=production",
    path: ["RESET_API_TOKEN"],
  })
  .refine((c) => !(c.APP_ENV === "production" && c.AI_PROVIDER === "stub"), {
    message: "AI_PROVIDER=stub is rejected in production",
    path: ["AI_PROVIDER"],
  })
  .refine((c) => c.AI_PROVIDER === "stub" || c.AI_API_KEY !== undefined, {
    message: "AI_API_KEY is required unless AI_PROVIDER=stub",
    path: ["AI_API_KEY"],
  })
  .refine((c) => c.OCR_PROVIDER !== "hosted" || c.OCR_API_KEY !== undefined, {
    message: "OCR_API_KEY is required when OCR_PROVIDER=hosted",
    path: ["OCR_API_KEY"],
  });

export type Config = z.infer<typeof schema>;

/** Every key the schema reads. `.env.example` must list each one (11.8 rule 1). */
export const CONFIG_KEYS: readonly string[] = Object.keys(schema.shape);

/** The secret keys the log serialiser redacts. The Secret column of 11.2 to 11.5. */
export const SECRET_KEYS = [
  "DATABASE_URL",
  "VALKEY_URL",
  "OPENSEARCH_USERNAME",
  "OPENSEARCH_PASSWORD",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "AI_API_KEY",
  "OCR_API_KEY",
  "AUTH_SECRET",
  "RESET_API_TOKEN",
  "HEALTH_TOKEN",
] as const;
