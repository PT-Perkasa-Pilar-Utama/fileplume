import { describe, expect, test } from "bun:test";
import type { DependencyProbe, ProbeResult, ProbeStatus } from "./ports.ts";
import { aggregate, expectedConfirmToken, healthHttpStatus, runHealthCheck } from "./service.ts";

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
