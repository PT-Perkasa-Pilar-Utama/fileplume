import type { Config } from "@archiva/config";
import { type DbHandle, runMigrations, seedDev, seedQa } from "@archiva/db";
import type { ResetSeed, ResetStageActions } from "@archiva/platform";
import { type RedisClient, S3Client } from "bun";

export type SystemResetActionsDeps = {
  config: Config;
  dbHandle?: DbHandle;
  redisClient?: RedisClient;
};

export function createSystemResetActions(deps: SystemResetActionsDeps): ResetStageActions {
  const { config, dbHandle, redisClient } = deps;

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
      const s3 = new S3Client({
        endpoint: config.S3_ENDPOINT,
        bucket: config.S3_BUCKET,
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
        region: config.S3_REGION,
      });
      const list = await s3.list({ prefix: "t/" });
      if (list.contents && list.contents.length > 0) {
        await Promise.all(list.contents.map((item) => s3.delete(item.key)));
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
