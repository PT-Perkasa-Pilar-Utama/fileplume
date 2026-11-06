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
    outcome: { state: "ready" } | { state: "failed"; reason: FailureReason },
  ): Promise<boolean>;
}

export interface DerivedDataPort {
  /** Remove version-scoped search output idempotently before guarded failure is recorded. */
  remove(run: ProcessingRun): Promise<void>;
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
      const result = await stage(run);
      if (result.ok) continue;
      if (!(await deps.state.isCurrentRun(tenantId, documentId, versionId))) return "stale";
      if (result.error.retryable && attempt < maxAttempts) return "retry";
      await deps.derivedData.remove(run);
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
