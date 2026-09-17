import { describe, expect, test } from "bun:test";
import { ResetRunner } from "./internal/reset-runner.ts";
import type { DependencyProbe, ProbeResult, ProbeStatus } from "./ports.ts";
import { aggregate, expectedConfirmToken, healthHttpStatus, runHealthCheck } from "./service.ts";
import { inMemoryResetStageActions } from "./testing/in-memory-reset-actions.ts";

const probe = (name: string, canDegrade: boolean, status: ProbeStatus): DependencyProbe => ({
  name,
  canDegrade,
  check: async (): Promise<ProbeResult> => ({ status }),
});

describe("health aggregation", () => {
  test("all ok is ok", async () => {
    const probes = [probe("postgres", false, "ok"), probe("valkey", false, "ok")];
    const report = await runHealthCheck(probes, "1.4.2");
    expect(report.status).toBe("ok");
    expect(report.version).toBe("1.4.2");
  });

  test("a survivable dependency going down degrades the system", async () => {
    // aiProvider can degrade: classification stalls, everything else works.
    const probes = [probe("postgres", false, "ok"), probe("aiProvider", true, "down")];
    const report = await runHealthCheck(probes, "1.4.2");
    expect(report.status).toBe("degraded");
  });

  test("postgres cannot degrade, it downs", async () => {
    const probes = [probe("postgres", false, "down"), probe("aiProvider", true, "ok")];
    const report = await runHealthCheck(probes, "1.4.2");
    expect(report.status).toBe("down");
  });

  test("a throwing probe is down, not an exception", async () => {
    const throwing: DependencyProbe = {
      name: "clamav",
      canDegrade: false,
      check: async () => {
        throw new Error("connection refused");
      },
    };
    const report = await runHealthCheck([throwing], "1.4.2");
    expect(report.checks.clamav?.status).toBe("down");
    expect(report.status).toBe("down");
  });

  test("a missing probe result is down, never silently ok", () => {
    expect(aggregate({}, [probe("postgres", false, "ok")])).toBe("down");
  });

  test("probes report latency", async () => {
    const report = await runHealthCheck([probe("postgres", false, "ok")], "1.4.2");
    expect(typeof report.checks.postgres?.latencyMs).toBe("number");
  });
});

describe("health http status", () => {
  test("degraded still returns 200 so the container stays in rotation", () => {
    expect(healthHttpStatus("ok")).toBe(200);
    expect(healthHttpStatus("degraded")).toBe(200);
    expect(healthHttpStatus("down")).toBe(503);
  });
});

describe("reset confirmation token", () => {
  test("is environment-bound, so a SIT request cannot be replayed at UAT", () => {
    expect(expectedConfirmToken("sit")).toBe("reset-sit");
    expect(expectedConfirmToken("uat")).not.toBe(expectedConfirmToken("sit"));
  });
});

describe("ResetRunner", () => {
  test("starts a reset job successfully when confirm matches", async () => {
    const actions = inMemoryResetStageActions();
    const runner = new ResetRunner({ actions, appEnv: "dev" });

    const result = runner.start("reset-dev", "dev");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.status).toBe("queued");
    expect(result.value.seed).toBe("dev");
    expect(result.value.statusUrl).toBe(`/admin/reset-state/${result.value.jobId}`);

    // Wait for microtask async execution
    await new Promise((resolve) => setTimeout(resolve, 10));

    const job = runner.getJob(result.value.jobId);
    expect(job).not.toBeNull();
    expect(job?.status).toBe("succeeded");
    expect(job?.stage).toBe("flush_queue");
    expect(job?.error).toBeNull();
    expect(actions.auditRecorded).toBe(true);
    expect(actions.executedStages).toEqual([
      "drop",
      "migrate",
      "seed",
      "purge_blobs",
      "recreate_index",
      "flush_queue",
    ]);
  });

  test("refuses when confirm token does not match environment", () => {
    const actions = inMemoryResetStageActions();
    const runner = new ResetRunner({ actions, appEnv: "dev" });

    const result = runner.start("reset-sit", "dev");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("ConfirmMismatch");
    }
  });

  test("refuses when a reset is already active", () => {
    let slowResolve: () => void = () => {};
    const slowActions = inMemoryResetStageActions();
    slowActions.drop = () =>
      new Promise<void>((r) => {
        slowResolve = r;
      });

    const runner = new ResetRunner({ actions: slowActions, appEnv: "dev" });
    const first = runner.start("reset-dev", "dev");
    expect(first.ok).toBe(true);

    const second = runner.start("reset-dev", "dev");
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.kind).toBe("ResetAlreadyRunning");
    }

    slowResolve();
  });

  test("records error and stage when a stage fails", async () => {
    const actions = inMemoryResetStageActions({ failAtStage: "seed" });
    const runner = new ResetRunner({ actions, appEnv: "dev" });

    const result = runner.start("reset-dev", "qa");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await new Promise((resolve) => setTimeout(resolve, 10));

    const job = runner.getJob(result.value.jobId);
    expect(job?.status).toBe("failed");
    expect(job?.stage).toBe("seed");
    expect(job?.error).toContain("Simulated failure at seed");
  });
});
