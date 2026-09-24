/**
 * Compensation is best effort: the primary outcome must not be masked. A
 * failure is still alerted rather than swallowed. CODING_STANDARD.md 6.3.
 */
export function reportSettled(results: PromiseSettledResult<unknown>[], msg: string): void {
  for (const result of results) {
    if (result.status === "rejected") {
      console.error({
        msg,
        err: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }
}
