import { err, ok, RESET_STAGES, type Result } from "@archiva/shared";
import type { ConfirmMismatch, ResetAlreadyRunning } from "../errors.ts";
import type { Clock, ResetJob, ResetSeed, ResetStage, ResetStageActions } from "../ports.ts";
import { expectedConfirmToken } from "../service.ts";

export type ResetAccepted = {
  jobId: string;
  status: "queued";
  seed: ResetSeed;
  statusUrl: string;
};

export type ResetRunnerOptions = {
  actions: ResetStageActions;
  appEnv: string;
  clock?: Clock;
  retentionMs?: number;
};

const ONE_HOUR_MS = 60 * 60 * 1000;

export class ResetRunner {
  private activeJobId: string | null = null;
  private readonly jobs = new Map<string, { job: ResetJob; completedAt?: number }>();
  private readonly actions: ResetStageActions;
  private readonly appEnv: string;
  private readonly clock: Clock;
  private readonly retentionMs: number;

  constructor(options: ResetRunnerOptions) {
    this.actions = options.actions;
    this.appEnv = options.appEnv;
    this.clock = options.clock ?? { now: () => new Date() };
    this.retentionMs = options.retentionMs ?? ONE_HOUR_MS;
  }

  start(
    confirm: string,
    seed: ResetSeed = "dev",
  ): Result<ResetAccepted, ResetAlreadyRunning | ConfirmMismatch> {
    const expected = expectedConfirmToken(this.appEnv);
    if (confirm !== expected) {
      return err({ kind: "ConfirmMismatch" });
    }

    if (this.activeJobId !== null) {
      const current = this.jobs.get(this.activeJobId)?.job;
      if (current && (current.status === "queued" || current.status === "running")) {
        return err({ kind: "ResetAlreadyRunning" });
      }
    }

    const jobId = crypto.randomUUID();
    const job: ResetJob = {
      jobId,
      status: "queued",
      seed,
      stage: null,
      stages: [...RESET_STAGES],
      startedAt: null,
      finishedAt: null,
      error: null,
    };

    this.jobs.set(jobId, { job });
    this.activeJobId = jobId;

    // Run asynchronously outside the request-response cycle
    queueMicrotask(() => {
      this.executeJob(jobId, seed).catch(() => {
        // Handled internally in executeJob
      });
    });

    return ok({
      jobId,
      status: "queued",
      seed,
      statusUrl: `/admin/reset-state/${jobId}`,
    });
  }

  getJob(jobId: string): ResetJob | null {
    this.purgeExpired();
    const entry = this.jobs.get(jobId);
    return entry ? { ...entry.job } : null;
  }

  private async executeJob(jobId: string, seed: ResetSeed): Promise<void> {
    const entry = this.jobs.get(jobId);
    if (!entry) return;

    entry.job.status = "running";
    entry.job.startedAt = this.clock.now().toISOString();

    try {
      // 10.4 step 1: write audit event before anything is dropped
      await this.actions.recordAudit();

      const sequence: Array<{ stage: ResetStage; run: () => Promise<void> }> = [
        { stage: "drop", run: () => this.actions.drop() },
        { stage: "migrate", run: () => this.actions.migrate() },
        { stage: "seed", run: () => this.actions.seed(seed) },
        { stage: "purge_blobs", run: () => this.actions.purgeBlobs() },
        { stage: "recreate_index", run: () => this.actions.recreateIndex() },
        { stage: "flush_queue", run: () => this.actions.flushQueue() },
      ];

      for (const item of sequence) {
        entry.job.stage = item.stage;
        await item.run();
      }

      entry.job.status = "succeeded";
      entry.job.finishedAt = this.clock.now().toISOString();
    } catch (error) {
      entry.job.status = "failed";
      entry.job.error = error instanceof Error ? error.message : "Unknown error during reset";
      entry.job.finishedAt = this.clock.now().toISOString();
    } finally {
      entry.completedAt = Date.now();
      if (this.activeJobId === jobId) {
        this.activeJobId = null;
      }
    }
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.jobs.entries()) {
      if (entry.completedAt && now - entry.completedAt > this.retentionMs) {
        this.jobs.delete(id);
      }
    }
  }
}
