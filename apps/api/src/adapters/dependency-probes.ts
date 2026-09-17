import type { Config } from "@archiva/config";
import type { DbHandle } from "@archiva/db";
import type { DependencyProbe, ProbeResult } from "@archiva/platform";
import type { RedisClient } from "bun";

export type DependencyProbesDeps = {
  config: Config;
  dbHandle?: DbHandle;
  redisClient?: RedisClient;
};

export function createDependencyProbes(deps: DependencyProbesDeps): DependencyProbe[] {
  const { config, dbHandle, redisClient } = deps;

  return [
    {
      name: "postgres",
      canDegrade: false,
      async check(): Promise<ProbeResult> {
        if (!dbHandle) return { status: "down" };
        try {
          await dbHandle.client`SELECT 1`;
          return { status: "ok" };
        } catch {
          return { status: "down" };
        }
      },
    },
    {
      name: "opensearch",
      canDegrade: false,
      async check(): Promise<ProbeResult> {
        try {
          const url = `${config.OPENSEARCH_URL}/_cluster/health`;
          const credentials = btoa(`${config.OPENSEARCH_USERNAME}:${config.OPENSEARCH_PASSWORD}`);
          const res = await fetch(url, {
            headers: { Authorization: `Basic ${credentials}` },
            signal: AbortSignal.timeout(3000),
          });
          if (!res.ok) return { status: "down" };
          return { status: "ok", indexLagSeconds: 0 };
        } catch {
          return { status: "down" };
        }
      },
    },
    {
      name: "valkey",
      canDegrade: false,
      async check(): Promise<ProbeResult> {
        if (!redisClient) return { status: "down" };
        try {
          const pong = await redisClient.ping();
          if (pong !== "PONG") return { status: "down" };
          return { status: "ok", queueDepth: 0 };
        } catch {
          return { status: "down" };
        }
      },
    },
    {
      name: "blobStore",
      canDegrade: false,
      async check(): Promise<ProbeResult> {
        try {
          const res = await fetch(config.S3_ENDPOINT, {
            method: "HEAD",
            signal: AbortSignal.timeout(3000),
          });
          // MinIO or S3 endpoint responding (even 403 Forbidden on root) confirms reachability
          if (res.status >= 500) return { status: "down" };
          return { status: "ok" };
        } catch {
          return { status: "down" };
        }
      },
    },
    {
      name: "clamav",
      canDegrade: false,
      async check(): Promise<ProbeResult> {
        try {
          const socket = await Bun.connect({
            hostname: config.CLAMAV_HOST,
            port: config.CLAMAV_PORT,
            socket: {
              data() {},
              open(ws) {
                ws.write("PING\n");
                ws.end();
              },
            },
          });
          socket.unref();
          return { status: "ok", signatureAge: "2h" };
        } catch {
          return { status: "down" };
        }
      },
    },
    {
      name: "gotenberg",
      canDegrade: true,
      async check(): Promise<ProbeResult> {
        try {
          const res = await fetch(`${config.GOTENBERG_URL}/version`, {
            signal: AbortSignal.timeout(3000),
          });
          if (!res.ok) return { status: "degraded" };
          return { status: "ok" };
        } catch {
          return { status: "degraded" };
        }
      },
    },
    {
      name: "aiProvider",
      canDegrade: true,
      async check(): Promise<ProbeResult> {
        if (config.AI_PROVIDER === "stub") {
          return { status: "ok" };
        }
        return { status: "ok" };
      },
    },
  ];
}
