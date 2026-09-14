CREATE TYPE "public"."ai_field" AS ENUM('category', 'document_type', 'tag', 'author', 'extracted_field');--> statement-breakpoint
CREATE TYPE "public"."analytics_metric" AS ENUM('documents_total', 'documents_uploaded', 'searches_performed', 'searches_zero_result', 'documents_opened', 'category_overrides', 'field_overrides');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('document.upload', 'document.download', 'document.download_bulk', 'document.preview', 'document.delete', 'document.version_add', 'category.create', 'category.permission_change', 'config.change', 'ai.override', 'auth.login', 'auth.logout', 'auth.login_failed', 'admin.reset_state', 'malware.detected', 'tenant.create', 'access.denied', 'search.performed');--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('allowed', 'denied');--> statement-breakpoint
CREATE TYPE "public"."config_key" AS ENUM('max_file_size_mb', 'pending_confirmation_days', 'storage_quota_gb');--> statement-breakpoint
CREATE TYPE "public"."extraction_method" AS ENUM('native', 'ocr', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."failure_reason" AS ENUM('password_protected', 'unreadable_content', 'extraction_timeout', 'ai_unavailable', 'index_failed');--> statement-breakpoint
CREATE TYPE "public"."processing_state" AS ENUM('queued', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tag_source" AS ENUM('ai', 'user');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('member', 'head_of_team', 'admin_tenant', 'super_admin');--> statement-breakpoint
CREATE TABLE "quota_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bytes" bigint NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '15 minutes' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_config" (
	"tenant_id" uuid NOT NULL,
	"key" "config_key" NOT NULL,
	"value" text NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_config_tenant_id_key_pk" PRIMARY KEY("tenant_id","key")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subdomain" "citext" NOT NULL,
	"status" "tenant_status" DEFAULT 'active' NOT NULL,
	"storage_quota_bytes" bigint DEFAULT 53687091200 NOT NULL,
	"storage_used_bytes" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"email" "citext" NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_tenant_check" CHECK (("users"."role" = 'super_admin' AND "users"."tenant_id" IS NULL) OR ("users"."role" <> 'super_admin' AND "users"."tenant_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content_hash" char(64) NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"page_count" integer,
	"blob_key" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_versions_tenant_hash_key" UNIQUE("tenant_id","content_hash"),
	CONSTRAINT "document_versions_document_number_key" UNIQUE("document_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"uploader_id" uuid NOT NULL,
	"title" text NOT NULL,
	"current_version_id" uuid,
	"processing_state" "processing_state" DEFAULT 'queued' NOT NULL,
	"failure_reason" "failure_reason",
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_tenant_name_key" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "category_permissions" (
	"category_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"download_active" boolean DEFAULT false NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_classification" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"document_type" text,
	"ai_suggested_category_id" uuid,
	"ai_confidence" numeric(4, 3),
	"confirmed_at" timestamp with time zone,
	"confirmed_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ai_field_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"field" "ai_field" NOT NULL,
	"original_value" text,
	"new_value" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_metadata" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"author" text,
	"document_created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "document_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"content" text NOT NULL,
	CONSTRAINT "document_pages_version_number_key" UNIQUE("version_id","page_number")
);
--> statement-breakpoint
CREATE TABLE "document_tags" (
	"document_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tag" "citext" NOT NULL,
	"confidence" numeric(4, 3),
	"source" "tag_source" DEFAULT 'ai' NOT NULL,
	CONSTRAINT "document_tags_document_id_tag_pk" PRIMARY KEY("document_id","tag")
);
--> statement-breakpoint
CREATE TABLE "document_text" (
	"version_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"extraction_method" "extraction_method" NOT NULL,
	"language" text,
	"char_count" integer NOT NULL,
	"extracted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_rollups" (
	"tenant_id" uuid NOT NULL,
	"metric" "analytics_metric" NOT NULL,
	"bucket_date" date NOT NULL,
	"value" numeric NOT NULL,
	CONSTRAINT "analytics_rollups_tenant_id_metric_bucket_date_pk" PRIMARY KEY("tenant_id","metric","bucket_date")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" "audit_action" NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid,
	"outcome" "audit_outcome" DEFAULT 'allowed' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quota_reservations" ADD CONSTRAINT "quota_reservations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_config" ADD CONSTRAINT "tenant_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_config" ADD CONSTRAINT "tenant_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_current_version_id_document_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_permissions" ADD CONSTRAINT "category_permissions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_permissions" ADD CONSTRAINT "category_permissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_permissions" ADD CONSTRAINT "category_permissions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classification" ADD CONSTRAINT "document_classification_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classification" ADD CONSTRAINT "document_classification_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classification" ADD CONSTRAINT "document_classification_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classification" ADD CONSTRAINT "document_classification_ai_suggested_category_id_categories_id_fk" FOREIGN KEY ("ai_suggested_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classification" ADD CONSTRAINT "document_classification_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_field_overrides" ADD CONSTRAINT "ai_field_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_field_overrides" ADD CONSTRAINT "ai_field_overrides_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_field_overrides" ADD CONSTRAINT "ai_field_overrides_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_metadata" ADD CONSTRAINT "document_metadata_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_metadata" ADD CONSTRAINT "document_metadata_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_text" ADD CONSTRAINT "document_text_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_text" ADD CONSTRAINT "document_text_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_rollups" ADD CONSTRAINT "analytics_rollups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quota_reservations_tenant_idx" ON "quota_reservations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "quota_reservations_expires_idx" ON "quota_reservations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "document_versions_tenant_idx" ON "document_versions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "document_versions_document_idx" ON "document_versions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_versions_hash_idx" ON "document_versions" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "documents_tenant_idx" ON "documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "documents_tenant_state_idx" ON "documents" USING btree ("tenant_id","processing_state");--> statement-breakpoint
CREATE INDEX "audit_events_tenant_idx" ON "audit_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_events_tenant_created_idx" ON "audit_events" USING btree ("tenant_id","created_at");