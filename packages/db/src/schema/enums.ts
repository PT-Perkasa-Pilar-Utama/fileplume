import { pgEnum } from "drizzle-orm/pg-core";

/** technical-specs/06-data-model.md 6.1: native enums, mirrored in packages/shared. */
export const tenantStatus = pgEnum("tenant_status", ["active", "suspended"]);

export const configKey = pgEnum("config_key", [
  "max_file_size_mb",
  "pending_confirmation_days",
  "storage_quota_gb",
]);

export const userRole = pgEnum("user_role", [
  "member",
  "head_of_team",
  "admin_tenant",
  "super_admin",
]);

export const processingState = pgEnum("processing_state", [
  "queued",
  "processing",
  "ready",
  "failed",
]);

export const failureReason = pgEnum("failure_reason", [
  "password_protected",
  "unreadable_content",
  "extraction_timeout",
  "ai_unavailable",
  "index_failed",
]);

export const extractionMethod = pgEnum("extraction_method", ["native", "ocr", "mixed"]);
export const tagSource = pgEnum("tag_source", ["ai", "user"]);

export const aiField = pgEnum("ai_field", [
  "category",
  "document_type",
  "tag",
  "author",
  "extracted_field",
]);

export const auditOutcome = pgEnum("audit_outcome", ["allowed", "denied"]);

/**
 * The last two members are additions required by AC-41.05 and AC-12.02.
 * See api-specs/_index.md open items 2 and 3, and TL-S0-02.
 */
export const auditAction = pgEnum("audit_action", [
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
]);

export const analyticsMetric = pgEnum("analytics_metric", [
  "documents_total",
  "documents_uploaded",
  "searches_performed",
  "searches_zero_result",
  "documents_opened",
  "category_overrides",
  "field_overrides",
]);
