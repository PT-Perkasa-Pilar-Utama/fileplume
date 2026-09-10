import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit is a CLI that runs outside the application runtime, so it cannot
 * import packages/config: loadConfig validates the whole app schema and exits.
 * This is the one sanctioned direct read of the environment, and it fails loudly
 * rather than falling back to an empty string. See CODING_STANDARD.md 9.1.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("drizzle.config: DATABASE_URL is required");
  process.exit(1);
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
