import { hashSessionToken } from "@archiva/shared";
import { sql } from "drizzle-orm";
import { sessions } from "../../schema/index.ts";
import type { SeedSession } from "./dev-tenant.ts";
import type { SeedTx } from "./seed-transaction.ts";

const DAY_MS = 86_400_000;

/**
 * Upserts on `token_hash`, refreshing both expiries, so a rerun revives a
 * session that has gone idle. The raw token never reaches the table.
 */
export async function writeSessions(
  tx: SeedTx,
  seed: { sessions: SeedSession[]; userIdByEmail: Map<string, string>; absoluteTtlDays: number },
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + seed.absoluteTtlDays * DAY_MS);

  const rows = seed.sessions.map((session) => {
    const userId = seed.userIdByEmail.get(session.email);
    if (!userId) throw new Error(`seed: user ${session.email} was not written`);
    return { userId, tokenHash: hashSessionToken(session.token), expiresAt, lastSeenAt: now };
  });

  await tx
    .insert(sessions)
    .values(rows)
    .onConflictDoUpdate({
      target: sessions.tokenHash,
      set: {
        userId: sql`excluded.user_id`,
        expiresAt: sql`excluded.expires_at`,
        lastSeenAt: sql`excluded.last_seen_at`,
      },
    });
}
