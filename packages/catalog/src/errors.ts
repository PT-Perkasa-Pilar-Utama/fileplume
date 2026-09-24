import type { DocumentId } from "@archiva/shared";

export type UnsupportedType = { kind: "UnsupportedType" };
export type TooLarge = { kind: "TooLarge"; limitMb: number };
export type QuotaExceeded = { kind: "QuotaExceeded" };
export type DuplicateContent = { kind: "DuplicateContent"; existingDocumentId?: DocumentId };
export type BatchTooLarge = { kind: "BatchTooLarge" };
export type IdenticalContent = { kind: "IdenticalContent" };
export type NotFound = { kind: "NotFound" };
export type DownloadForbidden = { kind: "DownloadForbidden" };
export type TooManySelected = { kind: "TooManySelected" };
export type PreviewUnavailable = { kind: "PreviewUnavailable" };
export type SessionExpired = { kind: "SessionExpired" };
