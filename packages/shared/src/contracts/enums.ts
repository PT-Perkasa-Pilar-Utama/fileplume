/**
 * Closed value sets that cross the wire, declared once. packages/db builds its
 * native enums from these (technical-specs/06-data-model.md 6.1), so the
 * database, the API and the SPA cannot disagree about a member.
 */
export const TENANT_STATUSES = ["active", "suspended"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

/** api-specs/04-configuration.md 4.1. The closed key set. */
export const CONFIG_KEY_NAMES = [
  "max_file_size_mb",
  "pending_confirmation_days",
  "storage_quota_gb",
] as const;
export type ConfigKeyName = (typeof CONFIG_KEY_NAMES)[number];

/** technical-specs/12-document-processing-pipeline.md 12.2. Four states, no others. */
export const PROCESSING_STATES = ["queued", "processing", "ready", "failed"] as const;
export type ProcessingState = (typeof PROCESSING_STATES)[number];

/** technical-specs/06-data-model.md 6.10.1. */
export const FAILURE_REASONS = [
  "password_protected",
  "unreadable_content",
  "extraction_timeout",
  "ai_unavailable",
  "index_failed",
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

/** api-specs/05-documents.md 5.1. Derived from the sniffed MIME type. */
export const FILE_TYPES = ["pdf", "docx", "xlsx", "txt"] as const;
export type FileType = (typeof FILE_TYPES)[number];

export const AUDIT_OUTCOMES = ["allowed", "denied"] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

/** api-specs/09-activity.md 9.1.1. */
export const AUDIT_ACTIONS = [
  "document.upload",
  "document.download",
  "document.download_bulk",
  "document.preview",
  "document.delete",
  "document.version_add",
  "category.create",
  "category.permission_change",
  "config.change",
  "ai.override",
  "auth.login",
  "auth.logout",
  "auth.login_failed",
  "admin.reset_state",
  "malware.detected",
  "tenant.create",
  "access.denied",
  "search.performed",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** api-specs/02-authentication.md 2.4. Presentation, never a control. */
export const MENUS = [
  "dashboard",
  "document",
  "permission_category",
  "audit_trail",
  "analytics",
  "configuration",
  "tenant_management",
] as const;
export type Menu = (typeof MENUS)[number];

/** api-specs/04-configuration.md 4.5. */
export const STORAGE_LEVELS = ["ok", "warning", "full"] as const;
export type StorageLevel = (typeof STORAGE_LEVELS)[number];

/** api-specs/10-system.md 10.3. */
export const PROBE_STATUSES = ["ok", "degraded", "down"] as const;

/** api-specs/10-system.md 10.4, 10.5. */
export const RESET_SEEDS = ["dev", "qa"] as const;
export const RESET_JOB_STATUSES = ["queued", "running", "succeeded", "failed"] as const;
export const RESET_STAGES = [
  "drop",
  "migrate",
  "seed",
  "purge_blobs",
  "recreate_index",
  "flush_queue",
] as const;
