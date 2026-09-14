import type { RedisClient } from "bun";
import type { ClientRateLimitInfo, Store } from "hono-rate-limiter";
import type { AppEnv } from "../middleware/context.ts";
import type { RateLimitStoreFactory } from "../middleware/rate-limits.ts";

/**
 * A fixed window in one atomic script. The first hit sets the expiry, so two
 * concurrent requests cannot both read a count and both decide it is under.
 */
const INCREMENT_SCRIPT = `
local hits = redis.call("INCR", KEYS[1])
if hits == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
return { hits, redis.call("PTTL", KEYS[1]) }
`;

function toInfo(reply: unknown): ClientRateLimitInfo {
  if (!Array.isArray(reply) || reply.length !== 2) {
    throw new Error("rate limit script returned an unexpected reply");
  }
  const [hits, ttlMs] = reply;
  return { totalHits: Number(hits), resetTime: new Date(Date.now() + Number(ttlMs)) };
}

function valkeyStore(client: RedisClient, prefix: string): Store<AppEnv> {
  let windowMs = 0;
  return {
    prefix,
    init(options) {
      windowMs = options.windowMs;
    },
    async increment(key) {
      const args = [INCREMENT_SCRIPT, "1", `${prefix}${key}`, String(windowMs)];
      return toInfo(await client.send("EVAL", args));
    },
    async decrement(key) {
      await client.decr(`${prefix}${key}`);
    },
    async resetKey(key) {
      await client.del(`${prefix}${key}`);
    },
  };
}

/** technical-specs/07-security.md 7.4: limits live in Valkey so every api replica shares them. */
export function createValkeyRateLimitStores(client: RedisClient): RateLimitStoreFactory {
  return (name) => valkeyStore(client, `archiva:rate-limit:${name}:`);
}
