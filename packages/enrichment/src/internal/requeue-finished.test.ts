import { describe, expect, test } from "bun:test";
import { type FinishedJob, requeueFinishedJob } from "../index.ts";

function fakeJob(states: string[], requeueErrors: (Error | undefined)[] = []) {
  let calls = 0;
  const job: FinishedJob = {
    async getState() {
      const state = states[Math.min(calls, states.length - 1)];
      if (state === undefined) throw new Error("Missing state fixture");
      return state;
    },
    async retry() {
      const error = requeueErrors[calls];
      calls += 1;
      if (error) throw error;
    },
  };
  return { job, attempts: () => calls };
}

describe("requeueFinishedJob", () => {
  test("a job another producer already queued is not requeued again", async () => {
    const f = fakeJob(["waiting"]);
    await requeueFinishedJob(f.job);
    expect(f.attempts()).toBe(0);
  });

  test("a requeue that loses the race verifies the queue instead of failing", async () => {
    const f = fakeJob(["completed", "waiting"], [new Error("Job is not in the completed state")]);
    await requeueFinishedJob(f.job);
    expect(f.attempts()).toBe(1);
  });

  test("a job that finished again after another producer's requeue is requeued once more", async () => {
    const f = fakeJob(["failed", "completed", "completed"], [new Error("Not in the failed state")]);
    await requeueFinishedJob(f.job);
    expect(f.attempts()).toBe(2);
  });

  test("a state the requeue protocol cannot act on is refused", async () => {
    const f = fakeJob(["unknown"]);
    await expect(requeueFinishedJob(f.job)).rejects.toThrow(
      'Cannot requeue a job in state "unknown"',
    );
  });

  test("a requeue that keeps failing past the conflict bound surfaces the error", async () => {
    const f = fakeJob(
      ["completed", "completed", "completed", "completed", "completed", "completed"],
      Array.from({ length: 5 }, () => new Error("Queue unavailable")),
    );
    await expect(requeueFinishedJob(f.job)).rejects.toThrow("Queue unavailable");
  });
});
