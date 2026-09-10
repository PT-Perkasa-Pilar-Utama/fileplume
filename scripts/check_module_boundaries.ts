/**
 * A module never imports another module's internals. The exports map makes it
 * physically impossible at runtime; this makes it a fast, readable CI failure.
 * technical-specs/02-system-architecture.md 2.1.2, 03-repository-structure.md 3.2.
 */
import { Glob } from "bun";

const violations: string[] = [];
const glob = new Glob("{apps,packages}/**/*.{ts,tsx}");

const FORBIDDEN = [
  // Reaching into another package's src by relative path.
  /from\s+["'](?:\.\.\/){2,}[a-z-]+\/src\//,
  // Reaching into any module's internal folder from outside it.
  /from\s+["'][^"']*\.\.\/[^"']*\/internal\//,
  // Deep-importing a workspace package past its entry point.
  /from\s+["']@archiva\/[a-z-]+\/(?!$)[^"']+["']/,
];

for await (const file of glob.scan(".")) {
  if (file.includes("node_modules") || file.includes("/dist/")) continue;
  const source = await Bun.file(file).text();
  for (const [i, line] of source.split("\n").entries()) {
    for (const pattern of FORBIDDEN) {
      if (pattern.test(line)) {
        violations.push(`${file}:${i + 1}: ${line.trim()}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Module boundary violations:\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error("\nImport a module only through its public entry point.");
  process.exit(1);
}

console.log("ok: no module boundary violations");
