import type { MalwareScanner } from "../ports.ts";

/**
 * Test double that always reports clean.
 * technical-specs/10-integration-points.md 10.3.
 */
export class AlwaysCleanScanner implements MalwareScanner {
  async scan(_stream: ReadableStream): Promise<{ infected: boolean; signature?: string }> {
    return { infected: false };
  }
}
