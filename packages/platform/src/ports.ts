export type ProbeStatus = "ok" | "degraded" | "down";

export type ProbeResult = {
  status: ProbeStatus;
  latencyMs?: number;
  [detail: string]: unknown;
};

export interface DependencyProbe {
  readonly name: string;
  /** Whether the system survives without it. Postgres cannot degrade, it downs. */
  readonly canDegrade: boolean;
  check(): Promise<ProbeResult>;
}
