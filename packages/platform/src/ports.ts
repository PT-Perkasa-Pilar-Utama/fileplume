import type { RESET_SEEDS, RESET_STAGES } from "@archiva/shared";

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

export type ResetStage = (typeof RESET_STAGES)[number];
export type ResetSeed = (typeof RESET_SEEDS)[number];
export type ResetJobStatus = "queued" | "running" | "succeeded" | "failed";

export type ResetJob = {
  jobId: string;
  status: ResetJobStatus;
  seed: ResetSeed;
  stage: ResetStage | null;
  stages: ResetStage[];
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
};

export interface ResetStageActions {
  recordAudit(): Promise<void>;
  drop(): Promise<void>;
  migrate(): Promise<void>;
  seed(seed: ResetSeed): Promise<void>;
  purgeBlobs(): Promise<void>;
  recreateIndex(): Promise<void>;
  flushQueue(): Promise<void>;
}

export interface Clock {
  now(): Date;
}
