import { one } from "@archiva/shared";
import {
  createCategory,
  listCategories,
  renameCategory,
  setDownloadPermission,
} from "./definitions/categories.ts";
import { listOf, MOCK_CATEGORY } from "./mocks.ts";
import { createRouter } from "./router.ts";

/** api-specs/06-categories.md. Cards BE-S3-03, BE-S5-03, FE-S3-02, FE-S5-03. */
export const categoryRoutes = createRouter()
  .openapi(listCategories, (c) => c.json(listOf(MOCK_CATEGORY), 200))
  // 6.3, a new category is always Inactive
  .openapi(createCategory, (c) => c.json(one({ ...MOCK_CATEGORY, downloadActive: false }), 201))
  .openapi(renameCategory, (c) => c.json(one(MOCK_CATEGORY), 200))
  .openapi(setDownloadPermission, (c) =>
    c.json(one({ ...MOCK_CATEGORY, downloadActive: c.req.valid("json").downloadActive }), 200),
  );
