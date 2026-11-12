import type { DocumentId, FailureReason, Result, TenantId, VersionId } from "@archiva/shared";

export type ProcessingRun = { tenantId: TenantId; documentId: DocumentId; versionId: VersionId };
export type StageFailure = { reason: FailureReason; retryable: boolean };
export type PipelineOutcome = "ready" | "failed" | "retry" | "stale";
export type PipelineStage = (run: ProcessingRun) => Promise<Result<void, StageFailure>>;

export interface PipelineStatePort {
  isCurrentRun(tenantId: TenantId, documentId: DocumentId, versionId: VersionId): Promise<boolean>;
  finishVersion(
    tenantId: TenantId,
    documentId: DocumentId,
    versionId: VersionId,
    outcome: { state: "ready" } | { state: "failed"; reason: FailureReason | null },
  ): Promise<boolean>;
}

export interface DerivedDataPort {
  /** Atomically remove this run's derived data only while its version remains current. */
  removeIfCurrent(run: ProcessingRun): Promise<boolean>;
}

export type PipelineDeps = {
  state: PipelineStatePort;
  extract: PipelineStage;
  classify: PipelineStage;
  index: PipelineStage;
  derivedData: DerivedDataPort;
};

/** docs/technical-specs/12-document-processing-pipeline.md §§12.1–12.4. */
export function createPipeline(
  deps: PipelineDeps,
): (run: ProcessingRun, attempt: number, maxAttempts: number) => Promise<PipelineOutcome> {
  return async (run, attempt, maxAttempts) => {
    const { tenantId, documentId, versionId } = run;
    for (const stage of [deps.extract, deps.classify, deps.index]) {
      if (!(await deps.state.isCurrentRun(tenantId, documentId, versionId))) return "stale";
      let result: Result<void, StageFailure>;
      try {
        result = await stage(run);
      } catch (error: unknown) {
        if (attempt < maxAttempts) throw error;
        console.error({ msg: "document pipeline stage failed", error });
        if (!(await deps.derivedData.removeIfCurrent(run))) return "stale";
        const finished = await deps.state.finishVersion(tenantId, documentId, versionId, {
          state: "failed",
          reason: null,
        });
        return finished ? "failed" : "stale";
      }
      if (result.ok) continue;
      if (!(await deps.state.isCurrentRun(tenantId, documentId, versionId))) return "stale";
      const permanent =
        result.error.reason === "password_protected" ||
        result.error.reason === "unreadable_content";
      if (!permanent && result.error.retryable && attempt < maxAttempts) return "retry";
      if (!(await deps.derivedData.removeIfCurrent(run))) return "stale";
      const finished = await deps.state.finishVersion(tenantId, documentId, versionId, {
        state: "failed",
        reason: result.error.reason,
      });
      return finished ? "failed" : "stale";
    }
    return (await deps.state.finishVersion(tenantId, documentId, versionId, { state: "ready" }))
      ? "ready"
      : "stale";
  };
}
