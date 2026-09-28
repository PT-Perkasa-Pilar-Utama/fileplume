import type { Config } from "@archiva/config";
import { type DbHandle, runMigrations, seedDev, seedQa } from "@archiva/db";
import type { ResetSeed, ResetStageActions } from "@archiva/platform";
import type { RedisClient, S3Client } from "bun";

export type SystemResetActionsDeps = {
  config: Config;
  dbHandle?: DbHandle;
  redisClient?: RedisClient;
  s3Client?: S3Client;
};

export function createSystemResetActions(deps: SystemResetActionsDeps): ResetStageActions {
  const { config, dbHandle, redisClient, s3Client } = deps;

  return {
    async recordAudit(): Promise<void> {
      console.info({
        event: "admin.reset_state",
        timestamp: new Date().toISOString(),
      });
    },

    async drop(): Promise<void> {
      if (dbHandle) {
        await dbHandle.client`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`;
      }
    },

    async migrate(): Promise<void> {
      if (dbHandle) {
        await runMigrations(dbHandle.db);
      }
    },

    async seed(seed: ResetSeed): Promise<void> {
      if (!dbHandle) return;
      if (seed === "qa") {
        await seedQa(dbHandle.db, { sessionAbsoluteTtlDays: config.SESSION_ABSOLUTE_TTL_DAYS });
      } else {
        await seedDev(dbHandle.db, { sessionAbsoluteTtlDays: config.SESSION_ABSOLUTE_TTL_DAYS });
      }
    },

    async purgeBlobs(): Promise<void> {
      if (!s3Client) return;
      const list = await s3Client.list({ prefix: "t/" });
      if (list.contents && list.contents.length > 0) {
        await Promise.all(list.contents.map((item) => s3Client.delete(item.key)));
      }
    },

    async recreateIndex(): Promise<void> {
      const indexName = `${config.OPENSEARCH_INDEX_PREFIX}-pages`;
      const credentials = btoa(`${config.OPENSEARCH_USERNAME}:${config.OPENSEARCH_PASSWORD}`);
      const headers = {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      };

      const deleteRes = await fetch(`${config.OPENSEARCH_URL}/${indexName}`, {
        method: "DELETE",
        headers,
        signal: AbortSignal.timeout(3000),
      });
      if (!deleteRes.ok && deleteRes.status !== 404) {
        throw new Error(
          `Failed to delete OpenSearch index: ${deleteRes.status} ${deleteRes.statusText}`,
        );
      }

      const createRes = await fetch(`${config.OPENSEARCH_URL}/${indexName}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          settings: { number_of_shards: 1, number_of_replicas: 0 },
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (!createRes.ok && createRes.status !== 400) {
        throw new Error(
          `Failed to create OpenSearch index: ${createRes.status} ${createRes.statusText}`,
        );
      }
    },

    async flushQueue(): Promise<void> {
      if (redisClient) {
        await redisClient.flushdb();
      }
    },
  };
}
