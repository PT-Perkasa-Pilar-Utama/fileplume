declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type TenantId = Brand<string, "TenantId">;
export type UserId = Brand<string, "UserId">;
export type DocumentId = Brand<string, "DocumentId">;
export type VersionId = Brand<string, "VersionId">;
export type CategoryId = Brand<string, "CategoryId">;
export type SessionId = Brand<string, "SessionId">;

export const asTenantId = (v: string) => v as TenantId;
export const asUserId = (v: string) => v as UserId;
export const asDocumentId = (v: string) => v as DocumentId;
export const asVersionId = (v: string) => v as VersionId;
export const asCategoryId = (v: string) => v as CategoryId;
