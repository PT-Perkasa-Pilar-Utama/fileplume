/**
 * The compose topology keeps the promises the docs make about it: every
 * third-party image pins a tag and a digest, every long-running dependency
 * declares a healthcheck, and production publishes only Caddy's ports.
 * technical-specs/04-tech-stack.md 4.10; DEPLOYMENT_PLAN.md 2.
 *
 * Reads the config `docker compose` itself renders, so overlays, `!reset` and
 * interpolation resolve exactly as they do for `up`. Needs `.env` present.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Glob } from "bun";

const DIGEST = /@sha256:[0-9a-f]{64}$/;
// Application images are tagged by exact commit SHA instead. DEPLOYMENT_PLAN.md 3.
const OWN_REGISTRY = "ghcr.io/pt-perkasa-pilar-utama/";
const PROXY_SERVICE = "caddy";
const PROXY_PUBLISHED_PORTS = 3;

// Placeholders that let the production overlay render. Nothing is started.
const PRODUCTION_PLACEHOLDERS = [
  "ARCHIVA_VERSION=check",
  "ARCHIVA_DOMAIN=check.invalid",
  "POSTGRES_PASSWORD=check",
  "MINIO_ROOT_USER=check",
  "MINIO_ROOT_PASSWORD=check",
].join("\n");

type Service = {
  image: string | undefined;
  built: boolean;
  oneShot: boolean;
  healthchecked: boolean;
  publishedPorts: number;
};

const violations: string[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toService(raw: unknown): Service {
  const service = isRecord(raw) ? raw : {};
  const ports = Array.isArray(service.ports) ? service.ports : [];
  return {
    image: typeof service.image === "string" ? service.image : undefined,
    built: service.build !== undefined,
    oneShot: service.restart === "no",
    healthchecked: isRecord(service.healthcheck) && service.healthcheck.disable !== true,
    publishedPorts: ports.filter((port) => isRecord(port) && port.published !== undefined).length,
  };
}

function render(files: string[], envFiles: string[]): Map<string, Service> {
  const result = Bun.spawnSync([
    "docker",
    "compose",
    ...envFiles.flatMap((file) => ["--env-file", file]),
    ...files.flatMap((file) => ["-f", file]),
    "config",
    "--format",
    "json",
  ]);
  if (result.exitCode !== 0) {
    console.error(
      `docker compose config failed for ${files.join(" + ")}:\n${result.stderr.toString()}`,
    );
    process.exit(1);
  }
  const parsed: unknown = JSON.parse(result.stdout.toString());
  if (!isRecord(parsed) || !isRecord(parsed.services)) {
    console.error(`docker compose config for ${files.join(" + ")} rendered no services`);
    process.exit(1);
  }
  return new Map(Object.entries(parsed.services).map(([name, raw]) => [name, toService(raw)]));
}

function isApplication(service: Service): boolean {
  return service.built || (service.image?.startsWith(OWN_REGISTRY) ?? false);
}

function checkServices(label: string, services: Map<string, Service>): void {
  for (const [name, service] of services) {
    if (isApplication(service)) continue;
    if (service.image === undefined || !DIGEST.test(service.image)) {
      violations.push(`${label} ${name}: image "${service.image ?? ""}" has no @sha256 digest`);
    }
    if (!service.oneShot && !service.healthchecked) {
      violations.push(`${label} ${name}: long-running service declares no healthcheck`);
    }
  }
}

function checkPublishedPorts(services: Map<string, Service>): void {
  for (const [name, service] of services) {
    const expected = name === PROXY_SERVICE ? PROXY_PUBLISHED_PORTS : 0;
    if (service.publishedPorts !== expected) {
      violations.push(
        `production ${name}: publishes ${service.publishedPorts} host ports, expected ${expected}`,
      );
    }
  }
}

async function checkDockerfiles(): Promise<void> {
  for await (const file of new Glob("apps/*/Dockerfile").scan(".")) {
    const stages = new Set<string>();
    const source = await Bun.file(file).text();
    for (const [i, line] of source.split("\n").entries()) {
      const from = /^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/i.exec(line.trim());
      if (from === null) continue;
      const [, image, stage] = from;
      if (image !== undefined && !stages.has(image) && !DIGEST.test(image)) {
        violations.push(`${file}:${i + 1}: base image "${image}" has no @sha256 digest`);
      }
      if (stage !== undefined) stages.add(stage);
    }
  }
}

const placeholders = join(tmpdir(), "archiva-check-compose.env");
await Bun.write(placeholders, PRODUCTION_PLACEHOLDERS);

checkServices("dev", render(["compose.yaml"], [".env"]));
const production = render(["compose.yaml", "compose.prod.yaml"], [".env", placeholders]);
checkServices("production", production);
checkPublishedPorts(production);
await checkDockerfiles();

if (violations.length > 0) {
  console.error("Compose topology violations:\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    "\nPin images per technical-specs/04-tech-stack.md 4.10. Publish ports on Caddy only.",
  );
  process.exit(1);
}

console.log("ok: images pinned, dependencies healthchecked, production ports on Caddy only");
