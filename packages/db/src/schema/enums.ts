import {
  AUDIT_ACTIONS,
  AUDIT_OUTCOMES,
  CONFIG_KEY_NAMES,
  FAILURE_REASONS,
  PROCESSING_STATES,
  ROLES,
  TENANT_STATUSES,
} from "@archiva/shared";
import { pgEnum } from "drizzle-orm/pg-core";

/**
 * technical-specs/06-data-model.md 6.1: native enums. A set that crosses the
 * wire is declared once in @archiva/shared and built here from that constant,
 * so the database and the API contract cannot disagree about a member. Sets
 * that never leave the server stay declared here.
 */
export const tenantStatus = pgEnum("tenant_status", TENANT_STATUSES);

export const configKey = pgEnum("config_key", CONFIG_KEY_NAMES);

export const userRole = pgEnum("user_role", ROLES);

export const processingState = pgEnum("processing_state", PROCESSING_STATES);

export const failureReason = pgEnum("failure_reason", FAILURE_REASONS);

export const extractionMethod = pgEnum("extraction_method", ["native", "ocr", "mixed"]);
export const tagSource = pgEnum("tag_source", ["ai", "user"]);

export const aiField = pgEnum("ai_field", [
  "category",
  "document_type",
  "tag",
  "author",
  "extracted_field",
]);

export const auditOutcome = pgEnum("audit_outcome", AUDIT_OUTCOMES);

/** `access.denied` and `search.performed` were additions required by AC-41.05 and AC-12.02 respectively, closed by TL-S0-02. */
export const auditAction = pgEnum("audit_action", AUDIT_ACTIONS);

export const analyticsMetric = pgEnum("analytics_metric", [
  "documents_total",
  "documents_uploaded",
  "searches_performed",
  "searches_zero_result",
  "documents_opened",
  "category_overrides",
  "field_overrides",
]);
