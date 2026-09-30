import type { MalwareScanner } from "../ports.ts";

/**
 * Test double that always reports infected, exercising AC-46.02 without an EICAR file on disk.
 * technical-specs/10-integration-points.md 10.3.
 */
export class AlwaysInfectedScanner implements MalwareScanner {
  constructor(private readonly signature = "Eicar-Test-Signature") {}

  async scan(_stream: ReadableStream): Promise<{ infected: boolean; signature?: string }> {
    return { infected: true, signature: this.signature };
  }
}

export function alwaysInfectedScanner(signature?: string): MalwareScanner {
  return new AlwaysInfectedScanner(signature);
}
