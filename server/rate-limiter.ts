interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly limit: number,
    private readonly windowMilliseconds: number,
  ) {}

  consume(key: string, now = Date.now()): RateLimitResult {
    let entry = this.entries.get(key);
    if (!entry || now - entry.windowStartedAt >= this.windowMilliseconds) {
      entry = { count: 0, windowStartedAt: now };
      this.entries.set(key, entry);
    }

    const resetAt = entry.windowStartedAt + this.windowMilliseconds;
    if (entry.count >= this.limit) {
      return { allowed: false, remaining: 0, resetAt };
    }

    entry.count += 1;
    this.prune(now);
    return {
      allowed: true,
      remaining: Math.max(0, this.limit - entry.count),
      resetAt,
    };
  }

  private prune(now: number): void {
    if (this.entries.size < 1_000) return;
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStartedAt >= this.windowMilliseconds) this.entries.delete(key);
    }
  }
}
