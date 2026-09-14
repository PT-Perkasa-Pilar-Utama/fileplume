/**
 * Writes apps/api/openapi.json from the registered routes, formatted by Biome
 * so `format:check` passes. openapi.test.ts fails when the committed file
 * differs, so run this after changing a contract. The in-memory test app is
 * enough: generating the document touches no dependency.
 */
import { OPENAPI_PATH, openApiDocument } from "../apps/api/src/openapi.ts";
import { buildTestApp } from "../apps/api/src/testing/test-app.ts";

await Bun.write(OPENAPI_PATH, JSON.stringify(openApiDocument(buildTestApp())));

const format = Bun.spawnSync(["bun", "x", "biome", "format", "--write", OPENAPI_PATH], {
  stdio: ["inherit", "inherit", "inherit"],
});
if (format.exitCode !== 0) {
  console.error(`biome format failed on ${OPENAPI_PATH}`);
  process.exit(format.exitCode);
}

console.log(`ok: wrote ${OPENAPI_PATH}`);
