import type { Result, TenantId } from "@archiva/shared";
import { asDocumentId, err } from "@archiva/shared";
import type { QuotaPort } from "../ports.ts";
import type { UploadFailure, UploadRejectedResult } from "../service.ts";

/**
 * Maps per-file upload failure back to the typed service error.
 */
export async function mapUploadFailure(
  rejected: UploadRejectedResult,
  tenantId: TenantId,
  quota: QuotaPort,
): Promise<Result<never, UploadFailure>> {
  switch (rejected.error.code) {
    case "UNSUPPORTED_TYPE":
      return err({ kind: "UnsupportedType" });
    case "FILE_TOO_LARGE": {
      const limitMb = await quota.getMaxFileSizeMb(tenantId);
      return err({ kind: "TooLarge", limitMb });
    }
    case "QUOTA_EXCEEDED":
      return err({ kind: "QuotaExceeded" });
    case "DUPLICATE_CONTENT":
      return err({
        kind: "DuplicateContent",
        ...(rejected.error.existingDocumentId
          ? { existingDocumentId: asDocumentId(rejected.error.existingDocumentId) }
          : {}),
      });
    default:
      throw new Error(`unmapped upload failure code: ${rejected.error.code}`);
  }
}
