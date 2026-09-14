import { searchContent, searchTitles } from "./definitions/discovery.ts";
import { listOf, MOCK_CONTENT_HIT, MOCK_TITLE_HIT } from "./mocks.ts";
import { createRouter } from "./router.ts";

/** api-specs/08-search.md. Cards BE-S4-02, BE-S4-03. */
export const searchRoutes = createRouter()
  .openapi(searchTitles, (c) => c.json(listOf(MOCK_TITLE_HIT), 200))
  .openapi(searchContent, (c) => c.json(listOf(MOCK_CONTENT_HIT), 200));
