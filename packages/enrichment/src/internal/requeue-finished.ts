const IN_FLIGHT = new Set(["waiting", "delayed", "active", "waiting-children"]);
const MAX_CONFLICTS = 5;

export type FinishedJob = {
  getState(): Promise<string>;
  retry(
    state: "completed" | "failed",
    opts: { resetAttemptsMade: boolean; resetAttemptsStarted: boolean },
  ): Promise<void>;
};

/**
 * Requeue a job that reached a terminal state, tolerating concurrent callers.
 *
 * BullMQ requeues a finished job in one atomic command, so every caller attempts it.
 * A caller that loses the race re-reads the state instead of assuming failure: a job
 * already waiting, delayed or active means the work is queued, and a job that finished
 * again means another caller's requeue already ran. Neither case loses the document.
 */
export async function requeueFinishedJob(job: FinishedJob): Promise<void> {
  let lastError: unknown;
  for (let remaining = MAX_CONFLICTS; remaining > 0; remaining--) {
    const state = await job.getState();
    if (IN_FLIGHT.has(state)) return;
    if (state !== "completed" && state !== "failed")
      throw new Error(`Cannot requeue a job in state "${state}"`);
    try {
      await job.retry(state, { resetAttemptsMade: true, resetAttemptsStarted: true });
      return;
    } catch (error: unknown) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Requeue conflict did not settle");
}
