import type { DependencyProbe, ProbeResult, ProbeStatus } from "./ports.ts";

export type HealthReport = {
  status: ProbeStatus;
  version: string;
  checks: Record<string, ProbeResult>;
};

/**
 * A dependency the system survives without degrades; one it cannot survive
 * downs. technical-specs/05-module-definitions.md 5.8.1.
 */
export function aggregate(
  checks: Record<string, ProbeResult>,
  probes: DependencyProbe[],
): ProbeStatus {
  let worst: ProbeStatus = "ok";
  for (const probe of probes) {
    const result = checks[probe.name];
    if (!result) return "down";
    if (result.status === "down") {
      if (!probe.canDegrade) return "down";
      worst = "degraded";
    } else if (result.status === "degraded") {
      worst = "degraded";
    }
  }
  return worst;
}

/** Real probes. A fake health check is worse than no health check. */
export async function runHealthCheck(
  probes: DependencyProbe[],
  version: string,
): Promise<HealthReport> {
  const entries = await Promise.all(
    probes.map(async (probe) => {
      const started = performance.now();
      try {
        const result = await probe.check();
        const latencyMs = Math.round(performance.now() - started);
        return [probe.name, { latencyMs, ...result }] as const;
      } catch {
        return [probe.name, { status: "down" } as ProbeResult] as const;
      }
    }),
  );
  const checks = Object.fromEntries(entries) as Record<string, ProbeResult>;
  return { status: aggregate(checks, probes), version, checks };
}

/**
 * 200 for ok and degraded, 503 for down. An orchestrator must not pull a
 * container out of rotation because a hosted provider is slow.
 */
export function healthHttpStatus(status: ProbeStatus): number {
  return status === "down" ? 503 : 200;
}

/** Environment-bound, so a request captured from SIT cannot be replayed at UAT. */
export function expectedConfirmToken(appEnv: string): string {
  return `reset-${appEnv}`;
}
