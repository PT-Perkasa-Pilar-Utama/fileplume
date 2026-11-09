export type Forbidden = { kind: "Forbidden" };
export type NotFound = { kind: "NotFound" };
export type TooManyTags = { kind: "TooManyTags" };
export type InvalidStateTransition = { kind: "InvalidStateTransition" };

/** Why text extraction refused the input. See technical-specs/12-document-processing-pipeline.md 12.4. */
export type TextExtractionFailure =
  | { kind: "PasswordProtected" }
  | { kind: "UnreadableContent" }
  | { kind: "ExtractionTimeout" }
  | { kind: "UnsupportedMimeType" };
