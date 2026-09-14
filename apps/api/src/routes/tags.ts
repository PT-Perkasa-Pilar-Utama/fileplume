import { listTopTags } from "./definitions/discovery.ts";
import { MOCK_TOP_TAG } from "./mocks.ts";
import { createRouter } from "./router.ts";

/** api-specs/07-enrichment.md 7.7. Card BE-S3-06. */
export const tagRoutes = createRouter().openapi(listTopTags, (c) =>
  c.json({ data: [MOCK_TOP_TAG, { tag: "legal", documentCount: 31 }], meta: { total: 2 } }, 200),
);
