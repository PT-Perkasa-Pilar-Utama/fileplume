import type { DocumentView, ListDocumentsQuery, Meta, TenantId } from "@archiva/shared";
import type { CatalogRepository } from "../repository.ts";
import { selectEmptyMessage, toDocumentView } from "./document-views.ts";
import type { ViewerContext } from "./list-document-query.ts";

export type ListDocumentsInput = {
  tenantId: TenantId;
  viewer: ViewerContext;
  pendingConfirmationDays?: number;
  now?: Date;
  query: ListDocumentsQuery;
};

export type ListDocumentsResult = {
  data: DocumentView[];
  meta: Meta;
};

export async function handleListDocuments(
  repository: CatalogRepository,
  input: ListDocumentsInput,
): Promise<ListDocumentsResult> {
  const now = input.now ?? new Date();
  const pendingDays = input.pendingConfirmationDays ?? 7;

  const { rows, total } = await repository.listDocuments(
    input.tenantId,
    {
      page: input.query.page,
      limit: input.query.limit,
      sort: input.query.sort,
      order: input.query.order,
      categoryId: input.query.categoryId,
      tags: input.query.tags,
      state: input.query.state,
      unconfirmedOnly: input.query.unconfirmedOnly,
      uploaderId: input.query.uploaderId,
    },
    input.viewer,
    pendingDays,
    now,
  );

  const data = rows.map(toDocumentView);
  const totalPages = Math.ceil(total / input.query.limit);

  let message: string | null = null;
  if (total === 0) {
    const tenantTotal = await repository.countTenantDocuments(input.tenantId);
    message = selectEmptyMessage({
      tenantTotal,
      categoryId: input.query.categoryId,
      tags: input.query.tags,
      unconfirmedOnly: input.query.unconfirmedOnly,
    });
  }

  const meta: Meta = {
    page: input.query.page,
    limit: input.query.limit,
    total,
    totalPages,
    message,
  };

  return { data, meta };
}
