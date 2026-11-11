import type { CategoryView } from "@archiva/shared";
import { asCategoryId, err, ok } from "@archiva/shared";
import type { ClassificationRepository } from "../repository.ts";

export function inMemoryClassificationRepository(): ClassificationRepository {
  const rows = new Map<string, { tenantId: string; view: CategoryView }>();
  return {
    async createCategory(tenantId, name, actor) {
      if (
        [...rows.values()].some(
          (row) => row.tenantId === tenantId && row.view.name.toLowerCase() === name.toLowerCase(),
        )
      )
        return err({ kind: "DuplicateName" });
      const view: CategoryView = {
        id: crypto.randomUUID(),
        name,
        isSystem: false,
        downloadActive: false,
        documentCount: 0,
        createdBy: { id: actor, name: "Test User" },
        createdAt: new Date().toISOString(),
        permissionUpdatedAt: null,
        permissionUpdatedBy: null,
      };
      rows.set(view.id, { tenantId, view });
      return ok(view);
    },
    async renameCategory(tenantId, id, name) {
      const row = rows.get(id);
      if (!row || row.tenantId !== tenantId) return err({ kind: "NotFound" });
      if (row.view.isSystem) return err({ kind: "SystemCategoryImmutable" });
      if (
        [...rows.values()].some(
          (other) =>
            other.tenantId === tenantId &&
            other.view.id !== id &&
            other.view.name.toLowerCase() === name.toLowerCase(),
        )
      )
        return err({ kind: "DuplicateName" });
      row.view = { ...row.view, name };
      return ok(row.view);
    },
    async listCategoryViews(tenantId, filter) {
      const matches = [...rows.values()]
        .filter(
          (row) =>
            row.tenantId === tenantId &&
            (!filter.q || row.view.name.toLowerCase().includes(filter.q.toLowerCase())),
        )
        .map((row) => row.view);
      matches.sort((a, b) => {
        const av = a[filter.sort];
        const bv = b[filter.sort];
        return (av < bv ? -1 : av > bv ? 1 : 0) * (filter.order === "asc" ? 1 : -1);
      });
      return {
        rows: matches.slice((filter.page - 1) * filter.limit, filter.page * filter.limit),
        total: matches.length,
      };
    },
    async listCategories(tenantId) {
      return [...rows.values()]
        .filter((row) => row.tenantId === tenantId)
        .map(({ view }) => ({
          id: asCategoryId(view.id),
          name: view.name,
          isSystem: view.isSystem,
          downloadActive: view.downloadActive,
        }));
    },
    async findCategory(tenantId, id) {
      const row = rows.get(id);
      return row && row.tenantId === tenantId
        ? {
            id: asCategoryId(row.view.id),
            name: row.view.name,
            isSystem: row.view.isSystem,
            downloadActive: row.view.downloadActive,
          }
        : null;
    },
    async setDownloadActive() {
      throw new Error("SCAFFOLD: implement in BE-S5-03");
    },
    async isDownloadActive(tenantId, id) {
      const row = rows.get(id);
      return row?.tenantId === tenantId && row.view.downloadActive;
    },
  };
}
