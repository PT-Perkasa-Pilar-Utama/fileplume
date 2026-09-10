export type * as SearchErrors from "./errors.ts";
export type { PageDocument, RawHit, SearchIndex } from "./ports.ts";
export type { ContentHit, SearchService } from "./service.ts";
export {
  createSearchService,
  isExactPhrase,
  isQueryLongEnough,
  MIN_QUERY_LENGTH,
  pageDocumentId,
  RELATED_LIMIT,
  rejectShortQuery,
} from "./service.ts";
