import type { TextExtractionFailure } from "@archiva/enrichment";
import { ProcessTimeoutError } from "./process-runner.ts";

/** AC-44.04: the input is encrypted, so no page can be read without a password. */
export class PasswordProtectedError extends Error {
  constructor(options?: ErrorOptions) {
    super("The document is protected by a password", options);
    this.name = "PasswordProtectedError";
  }
}

/** AC-44.05: the container or its content cannot be parsed. */
export class UnreadableInputError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UnreadableInputError";
  }
}

export class InputLimitError extends Error {
  constructor(maxBytes: number) {
    super(`Input exceeds the extraction limit of ${maxBytes} bytes`);
    this.name = "InputLimitError";
  }
}

/** Maps a thrown adapter error onto the port's typed failure, without guessing from text. */
export function extractionFailure(error: unknown): TextExtractionFailure {
  if (error instanceof PasswordProtectedError) return { kind: "PasswordProtected" };
  if (error instanceof ProcessTimeoutError) return { kind: "ExtractionTimeout" };
  if (error instanceof UnreadableInputError) return { kind: "UnreadableContent" };
  throw error;
}
