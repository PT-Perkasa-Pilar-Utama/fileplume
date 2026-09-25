import type { CatalogService, UploadSingleFileItem } from "@archiva/catalog";
import { AppError, asDocumentId, formatErrorMessage, one } from "@archiva/shared";
import type { TenancyService } from "@archiva/tenancy";
import type { Context } from "hono";
import type { AppEnv } from "../../middleware/context.ts";
import { fail } from "../../middleware/errors.ts";
import { assertDocumentInTenant } from "./assert-document-in-tenant.ts";
import { collectUploadParts } from "./collect-upload-parts.ts";

/**
 * Handles POST /documents/:id/versions. api-specs/05-documents.md 5.7.
 */
export async function handleUploadVersion(
  c: Context<AppEnv>,
  catalog: CatalogService,
  tenancy: Pick<TenancyService, "getConfigValue">,
): Promise<Response> {
  const tenant = c.get("tenant");
  if (!tenant) throw new AppError("NOT_FOUND");
  const principal = c.get("principal");
  const id = c.req.param("id");
  if (!id) throw new AppError("NOT_FOUND");
  const documentId = asDocumentId(id);

  await assertDocumentInTenant(c, catalog, id);

  const maxMb = await tenancy.getConfigValue(tenant.id, "max_file_size_mb");
  const maxFileSizeBytes = maxMb * 1024 * 1024;

  let items: UploadSingleFileItem[];
  try {
    items = await collectUploadParts(c.req.raw, 1, maxFileSizeBytes, "file");
  } catch (err) {
    if (err instanceof AppError) throw err;
    return fail(c, "UPLOAD_INTERRUPTED");
  }

  if (items.length !== 1) {
    return fail(c, "VALIDATION_ERROR", [{ field: "file", issue: "required" }]);
  }

  const item = items[0];
  if (!item) {
    return fail(c, "VALIDATION_ERROR", [{ field: "file", issue: "required" }]);
  }

  const result = await catalog.addVersion(documentId, {
    tenantId: tenant.id,
    uploaderId: principal.userId,
    filename: item.filename,
    stream: item.stream,
    sizeBytes: item.sizeBytes,
  });

  if (!result.ok) {
    switch (result.error.kind) {
      case "NotFound":
        return fail(c, "NOT_FOUND");
      case "IdenticalContent":
        return fail(c, "IDENTICAL_CONTENT");
      case "DuplicateContent":
        return fail(c, "DUPLICATE_CONTENT");
      case "UnsupportedType":
        return fail(c, "UNSUPPORTED_TYPE");
      case "TooLarge":
        throw new AppError(
          "FILE_TOO_LARGE",
          undefined,
          formatErrorMessage("FILE_TOO_LARGE", { n: result.error.limitMb }),
        );
      case "QuotaExceeded":
        return fail(c, "QUOTA_EXCEEDED");
      default:
        return fail(c, "VALIDATION_ERROR");
    }
  }

  return c.json(one(result.value), 201);
}
