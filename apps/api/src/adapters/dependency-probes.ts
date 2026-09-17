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
          // SCAFFOLD: real indexLagSeconds computation lands once BE-S4 wires index sync accounting.
          return { status: "ok" };
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
          // Measure real queue depth across wait and active lists for the document processing queue
          const waitCount = await redisClient.llen("bull:document.process:wait");
          const activeCount = await redisClient.llen("bull:document.process:active");
          const queueDepth = (waitCount ?? 0) + (activeCount ?? 0);
          return { status: "ok", queueDepth };
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
          return await new Promise<ProbeResult>((resolve) => {
            let settled = false;
            const timer = setTimeout(() => {
              if (!settled) {
                settled = true;
                resolve({ status: "down" });
              }
            }, 3000);

            Bun.connect({
              hostname: config.CLAMAV_HOST,
              port: config.CLAMAV_PORT,
              socket: {
                data(ws, data) {
                  if (settled) return;
                  settled = true;
                  clearTimeout(timer);
                  ws.end();
                  const text = data.toString();
                  // Format: ClamAV <version>/<sigVersion>/<date>
                  const parts = text.trim().split("/");
                  const dateStr = parts[2];
                  let signatureAge = "unknown";
                  if (dateStr) {
                    const sigDate = new Date(dateStr);
                    if (!Number.isNaN(sigDate.getTime())) {
                      const hours = Math.floor((Date.now() - sigDate.getTime()) / (1000 * 60 * 60));
                      signatureAge = `${hours}h`;
                    }
                  }
                  resolve({ status: "ok", signatureAge });
                },
                open(ws) {
                  ws.write("VERSION\n");
                },
                error(ws) {
                  if (settled) return;
                  settled = true;
                  clearTimeout(timer);
                  ws.end();
                  resolve({ status: "down" });
                },
                connectError(_ws) {
                  if (settled) return;
                  settled = true;
                  clearTimeout(timer);
                  resolve({ status: "down" });
                },
              },
            }).catch(() => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve({ status: "down" });
              }
            });
          });
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
        if (config.AI_PROVIDER === "anthropic") {
          try {
            const res = await fetch("https://api.anthropic.com", {
              method: "HEAD",
              signal: AbortSignal.timeout(3000),
            });
            return res.status < 500 ? { status: "ok" } : { status: "degraded" };
          } catch {
            return { status: "degraded" };
          }
        }
        return { status: "ok" };
      },
    },
  ];
}
