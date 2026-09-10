import { seedDev } from "./dev.ts";

/**
 * The dev set plus every fixture an acceptance criterion names by filename:
 * fixture-reporting-01.pdf (AC-06.01), kontrak-kerjasama.pdf with
 * "klausul-kerahasiaan" on page 15 (AC-33.01), a known-duplicate pair
 * (AC-03.01), a 25 MB file (AC-01.06), an EICAR test file (AC-46.02).
 * Implemented in TL-S0-03.
 */
export async function seedQa(): Promise<void> {
  await seedDev();
  throw new Error("SCAFFOLD: implement in TL-S0-03");
}

if (import.meta.main) await seedQa();
