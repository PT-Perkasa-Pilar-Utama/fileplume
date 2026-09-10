export type * as PlatformErrors from "./errors.ts";
export type { DependencyProbe, ProbeResult, ProbeStatus } from "./ports.ts";
export type { HealthReport } from "./service.ts";
export {
  aggregate,
  expectedConfirmToken,
  healthHttpStatus,
  runHealthCheck,
} from "./service.ts";
