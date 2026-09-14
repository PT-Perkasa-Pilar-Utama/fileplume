import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { OPENAPI_PATH, openApiDocument } from "./openapi.ts";
import { buildTestApp } from "./testing/test-app.ts";

const METHODS = ["get", "put", "post", "patch", "delete"] as const;
const TRACKER = join(import.meta.dir, "..", "..", "..", "docs", "api-specs", "_index.md");

/** Operational endpoints sit outside /api/v1 (api-specs/10-system.md). */
function documentedPath(method: string, specPath: string): string {
  const path = specPath.replace(/:(\w+)/g, "{$1}");
  const operational = path.startsWith("/health") || path.startsWith("/admin");
  return `${method} ${operational ? path : `/api/v1${path}`}`;
}

async function trackedOperations(): Promise<string[]> {
  const index = await Bun.file(TRACKER).text();
  return [...index.matchAll(/^\| `(GET|POST|PUT|PATCH|DELETE) (\/\S+)` \|/gm)].map(
    ([, method = "", path = ""]) => documentedPath(method, path),
  );
}

describe("OpenAPI document, api-specs/_index.md", () => {
  const doc = openApiDocument(buildTestApp());

  test("documents exactly the operations the tracker lists", async () => {
    const tracked = await trackedOperations();
    const documented = Object.entries(doc.paths ?? {}).flatMap(([path, item]) =>
      METHODS.filter((method) => item[method] !== undefined).map(
        (method) => `${method.toUpperCase()} ${path}`,
      ),
    );
    expect(tracked).toHaveLength(39);
    expect(documented.sort()).toEqual(tracked.sort());
  });

  test("names components from the shared schema ids", () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining(["Document", "DocumentDetail", "Category", "Session", "HealthReport"]),
    );
  });

  test("the committed openapi.json is current; run `bun run openapi:emit` if this fails", async () => {
    expect(JSON.parse(JSON.stringify(doc))).toEqual(await Bun.file(OPENAPI_PATH).json());
  });
});
