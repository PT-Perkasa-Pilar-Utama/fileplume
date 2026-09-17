import type { ResetSeed, ResetStage, ResetStageActions } from "../ports.ts";

export function inMemoryResetStageActions(options?: {
  failAtStage?: ResetStage;
  failAudit?: boolean;
}): ResetStageActions & { auditRecorded: boolean; executedStages: ResetStage[] } {
  const executedStages: ResetStage[] = [];
  let auditRecorded = false;

  const checkFail = (stage: ResetStage) => {
    if (options?.failAtStage === stage) {
      throw new Error(`Simulated failure at ${stage}`);
    }
  };

  return {
    get auditRecorded() {
      return auditRecorded;
    },
    get executedStages() {
      return executedStages;
    },

    async recordAudit() {
      if (options?.failAudit) throw new Error("Audit log failed");
      auditRecorded = true;
    },
    async drop() {
      checkFail("drop");
      executedStages.push("drop");
    },
    async migrate() {
      checkFail("migrate");
      executedStages.push("migrate");
    },
    async seed(_seed: ResetSeed) {
      checkFail("seed");
      executedStages.push("seed");
    },
    async purgeBlobs() {
      checkFail("purge_blobs");
      executedStages.push("purge_blobs");
    },
    async recreateIndex() {
      checkFail("recreate_index");
      executedStages.push("recreate_index");
    },
    async flushQueue() {
      checkFail("flush_queue");
      executedStages.push("flush_queue");
    },
  };
}
