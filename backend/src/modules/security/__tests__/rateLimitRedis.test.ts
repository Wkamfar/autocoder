import { describe, expect, it } from "vitest";
import { consumeRedisFixedWindow } from "../rateLimit.js";

class FakeRedis {
  private counts = new Map<string, number>();
  private expiresAt = new Map<string, number>();

  async incr(key: string): Promise<number> {
    const now = Date.now();
    const exp = this.expiresAt.get(key);
    if (exp && exp <= now) {
      this.counts.delete(key);
      this.expiresAt.delete(key);
    }
    const next = (this.counts.get(key) || 0) + 1;
    this.counts.set(key, next);
    return next;
  }

  async pttl(key: string): Promise<number> {
    const now = Date.now();
    const exp = this.expiresAt.get(key);
    if (!exp) return -1;
    const ttl = exp - now;
    if (ttl <= 0) return -2;
    return ttl;
  }

  async pexpire(key: string, ms: number): Promise<number> {
    this.expiresAt.set(key, Date.now() + ms);
    return 1;
  }
}

describe("Agent 5: Redis fixed-window limiter (unit)", () => {
  it("allows up to max then blocks with retryAfter", async () => {
    const redis = new FakeRedis();
    const key = "rl:test:ip:1.2.3.4";

    for (let i = 0; i < 3; i++) {
      const r = await consumeRedisFixedWindow({ redis, storeKey: key, windowMs: 5000, max: 3 });
      expect(r.allowed).toBe(true);
    }

    const blocked = await consumeRedisFixedWindow({ redis, storeKey: key, windowMs: 5000, max: 3 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeTruthy();
    expect((blocked.retryAfterSec as number) >= 1).toBe(true);
  });
});

