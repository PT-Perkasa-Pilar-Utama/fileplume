/**
 * Idempotent: running twice leaves the same state, and running against a
 * partially seeded database completes it rather than failing on a conflict.
 * Every insert is an upsert keyed on a stable natural key.
 * technical-specs/06-data-model.md 6.11. Implemented in TL-S0-03.
 */
export async function seedDev(): Promise<void> {
  throw new Error("SCAFFOLD: implement in TL-S0-03");
}

if (import.meta.main) await seedDev();
