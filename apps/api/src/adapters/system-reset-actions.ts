import type { Config } from "@archiva/config";
import { type DbHandle, runMigrations, seedDev, seedQa } from "@archiva/db";
import type { ResetSeed, ResetStageActions } from "@archiva/platform";
import type { RedisClient } from "bun";

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
      if (seed === "qa") {
        await seedQa();
      } else {
        await seedDev();
      }
    },

    async purgeBlobs(): Promise<void> {
      // Best-effort bucket wipe for testing environments
      try {
        await fetch(`${config.S3_ENDPOINT}/${config.S3_BUCKET}`, {
          method: "DELETE",
          signal: AbortSignal.timeout(3000),
        });
      } catch {
        // Blob store wipe is best effort
      }
    },

    async recreateIndex(): Promise<void> {
      // Recreate OpenSearch index
      try {
        const indexUrl = `${config.OPENSEARCH_URL}/${config.OPENSEARCH_INDEX_PREFIX}*`;
        const credentials = btoa(`${config.OPENSEARCH_USERNAME}:${config.OPENSEARCH_PASSWORD}`);
        await fetch(indexUrl, {
          method: "DELETE",
          headers: { Authorization: `Basic ${credentials}` },
          signal: AbortSignal.timeout(3000),
        });
      } catch {
        // OpenSearch reset is best effort
      }
    },

    async flushQueue(): Promise<void> {
      if (redisClient) {
        try {
          await redisClient.flushdb();
        } catch {
          // Valkey flush is best effort
        }
      }
    },
  };
}
