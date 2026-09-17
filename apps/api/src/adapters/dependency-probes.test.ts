import { describe, expect, test } from "bun:test";
import { BASE_CONFIG } from "../testing/test-app.ts";
import { createDependencyProbes } from "./dependency-probes.ts";
import { createSystemResetActions } from "./system-reset-actions.ts";

describe("createDependencyProbes", () => {
  test("postgres reports down when dbHandle is missing", async () => {
    const probes = createDependencyProbes({ config: BASE_CONFIG });
    const postgres = probes.find((p) => p.name === "postgres");
    expect(postgres).toBeDefined();
    const result = await postgres?.check();
    expect(result?.status).toBe("down");
  });

  test("valkey reports down when redisClient is missing", async () => {
    const probes = createDependencyProbes({ config: BASE_CONFIG });
    const valkey = probes.find((p) => p.name === "valkey");
    expect(valkey).toBeDefined();
    const result = await valkey?.check();
    expect(result?.status).toBe("down");
  });

  test("valkey reports ok with real measured queueDepth when client succeeds", async () => {
    const mockRedis = {
      ping: async () => "PONG",
      llen: async (key: string) => (key.includes("wait") ? 3 : 2),
    };
    const probes = createDependencyProbes({
      config: BASE_CONFIG,
      redisClient: mockRedis as never,
    });
    const valkey = probes.find((p) => p.name === "valkey");
    const result = await valkey?.check();
    expect(result?.status).toBe("ok");
    expect(result?.queueDepth).toBe(5);
  });

  test("aiProvider returns ok for stub configuration", async () => {
    const probes = createDependencyProbes({
      config: { ...BASE_CONFIG, AI_PROVIDER: "stub" },
    });
    const ai = probes.find((p) => p.name === "aiProvider");
    const result = await ai?.check();
    expect(result?.status).toBe("ok");
  });

  test("opensearch does not report fabricated indexLagSeconds", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: "green" }), { status: 200 })) as never;

    try {
      const probes = createDependencyProbes({ config: BASE_CONFIG });
      const opensearch = probes.find((p) => p.name === "opensearch");
      const result = await opensearch?.check();
      expect(result?.status).toBe("ok");
      expect(result?.indexLagSeconds).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("gotenberg degrades on HTTP failure", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response("down", { status: 500 })) as never;

    try {
      const probes = createDependencyProbes({ config: BASE_CONFIG });
      const gotenberg = probes.find((p) => p.name === "gotenberg");
      expect(gotenberg?.canDegrade).toBe(true);
      const result = await gotenberg?.check();
      expect(result?.status).toBe("degraded");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("createSystemResetActions", () => {
  test("recreateIndex propagates failure when OpenSearch DELETE fails", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("internal error", { status: 500, statusText: "Internal Error" })) as never;

    try {
      const actions = createSystemResetActions({ config: BASE_CONFIG });
      await expect(actions.recreateIndex()).rejects.toThrow("Failed to delete OpenSearch index");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("flushQueue propagates failure when redisClient fails", async () => {
    const mockRedis = {
      flushdb: async () => {
        throw new Error("Redis cluster disconnected");
      },
    };
    const actions = createSystemResetActions({
      config: BASE_CONFIG,
      redisClient: mockRedis as never,
    });
    await expect(actions.flushQueue()).rejects.toThrow("Redis cluster disconnected");
  });
});
