export type * as EnrichmentErrors from "./errors.ts";
export {
  DOCUMENT_QUEUE,
  documentJobOptions,
  PROCESS_DOCUMENT_JOB,
  PROCESSING_ATTEMPTS,
  PROCESSING_BACKOFF_MS,
  valkeyConnection,
} from "./internal/queue-options.ts";
export type {
  DerivedDataPort,
  PipelineDeps,
  PipelineOutcome,
  PipelineStage,
  PipelineStatePort,
  ProcessingRun,
  StageFailure,
} from "./pipeline.ts";
export { createPipeline } from "./pipeline.ts";
export type {
  AiProvider,
  JobQueue,
  MalwareScanner,
  ScanAuditPort,
  ScanBlobStore,
  ScanCatalogRepository,
  ScanQuotaPort,
  TextExtractor,
} from "./ports.ts";
export type { EnrichmentRepository } from "./repository.ts";
export type {
  AiField,
  EnrichmentService,
  ExtractionMethod,
  FailureReason,
  ProcessingState,
  TagSource,
} from "./service.ts";
export {
  canTransition,
  createEnrichmentService,
  isTransient,
  MAX_TAGS,
  STAGES,
  truncateTags,
} from "./service.ts";
export type { ExecuteScanStageParams, ScanStageResult } from "./stages/scan.ts";
export { executeScanStage } from "./stages/scan.ts";
export { AlwaysCleanScanner } from "./testing/always-clean-scanner.ts";
export { AlwaysInfectedScanner } from "./testing/always-infected-scanner.ts";
