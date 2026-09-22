import { describe, expect, test } from "bun:test";
import {
  analyticsDashboardSchema,
  auditEventSchema,
  bulkDownloadTicketSchema,
  categorySchema,
  classifiedDocumentSchema,
  collectionOf,
  contentHitSchema,
  documentDetailSchema,
  documentSchema,
  principalSchema,
  processingStatusSchema,
  relatedDocumentSchema,
  reprocessAcceptedSchema,
  sessionSchema,
  tenantListItemSchema,
  tenantSchema,
  titleHitSchema,
  topTagSchema,
  uploadBatchSchema,
} from "@archiva/shared";
import type { z } from "zod";
import * as mocks from "./mocks.ts";

/** Types check shape; parsing also checks formats such as uuid and ISO timestamps. */
const CONTRACTS: [string, z.ZodType, unknown][] = [
  ["MOCK_SESSION", sessionSchema, mocks.MOCK_SESSION],
  ["MOCK_PRINCIPAL", principalSchema, mocks.MOCK_PRINCIPAL],
  ["MOCK_TENANT", tenantSchema, mocks.MOCK_TENANT],
  ["MOCK_TENANT_ROW", tenantListItemSchema, mocks.MOCK_TENANT_ROW],
  ["MOCK_CATEGORY", categorySchema, mocks.MOCK_CATEGORY],
  ["MOCK_DOCUMENT", documentSchema, mocks.MOCK_DOCUMENT],
  ["MOCK_DOCUMENT_DETAIL", documentDetailSchema, mocks.MOCK_DOCUMENT_DETAIL],
  ["MOCK_CLASSIFIED_DOCUMENT", classifiedDocumentSchema, mocks.MOCK_CLASSIFIED_DOCUMENT],
  ["MOCK_UPLOAD_BATCH", uploadBatchSchema, mocks.MOCK_UPLOAD_BATCH],
  ["MOCK_BULK_TICKET", bulkDownloadTicketSchema, mocks.MOCK_BULK_TICKET],
  ["MOCK_PROCESSING", processingStatusSchema, mocks.MOCK_PROCESSING],
  ["MOCK_REPROCESS", reprocessAcceptedSchema, mocks.MOCK_REPROCESS],
  ["MOCK_TOP_TAG", topTagSchema, mocks.MOCK_TOP_TAG],
  ["MOCK_TITLE_HIT", titleHitSchema, mocks.MOCK_TITLE_HIT],
  ["MOCK_CONTENT_HIT", contentHitSchema, mocks.MOCK_CONTENT_HIT],
  ["MOCK_RELATED", relatedDocumentSchema, mocks.MOCK_RELATED],
  ["MOCK_AUDIT_EVENT", auditEventSchema, mocks.MOCK_AUDIT_EVENT],
  ["MOCK_DASHBOARD", analyticsDashboardSchema, mocks.MOCK_DASHBOARD],
  ["listOf(MOCK_DOCUMENT)", collectionOf(documentSchema), mocks.listOf(mocks.MOCK_DOCUMENT)],
];

describe("mocks satisfy their contracts", () => {
  test.each(CONTRACTS)("%s", (_, schema, mock) => {
    expect(schema.safeParse(mock).error?.issues).toBeUndefined();
  });
});
