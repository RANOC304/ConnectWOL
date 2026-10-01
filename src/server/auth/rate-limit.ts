/**
 * In-memory sliding-window rate limiter.
 *
 * ConnectWOL runs as a single Node.js process, so process memory is the right store: no extra
 * service, and counters reset on restart (acceptable for a self-hosted single-admin app).
 */
export interface LimitResult {
  allowed: boolean;
  /** Seconds until another attempt is allowed (0 when allowed). */
  retryAfterSec: number;
  remaining: number;
}

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  private recent(key: string): number[] {
    const cutoff = this.now() - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length === 0) this.hits.delete(key);
    else this.hits.set(key, list);
    return list;
  }

  private state(list: number[]): LimitResult {
    if (list.length >= this.limit) {
      const oldest = list[0] ?? this.now();
      return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((oldest + this.windowMs - this.now()) / 1000)) };
    }
    return { allowed: true, remaining: this.limit - list.length, retryAfterSec: 0 };
  }

  /** Looks at the current state without recording an attempt. */
  peek(key: string): LimitResult {
    return this.state(this.recent(key));
  }

  /** Records an attempt if the key is under the limit. */
  take(key: string): LimitResult {
    const list = this.recent(key);
    const result = this.state(list);
    if (result.allowed) {
      list.push(this.now());
      this.hits.set(key, list);
      this.sweep();
      return { ...result, remaining: result.remaining - 1 };
    }
    return result;
  }

  /** Records an attempt unconditionally (used for failed logins). */
  record(key: string): void {
    const list = this.recent(key);
    list.push(this.now());
    this.hits.set(key, list);
    this.sweep();
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  clear(): void {
    this.hits.clear();
  }

  /** Bounds memory under a flood of distinct keys. */
  private sweep(): void {
    if (this.hits.size < 5000) return;
    for (const key of [...this.hits.keys()]) this.recent(key);
  }
}

const globalForLimiters = globalThis as typeof globalThis & { __connectwolLimiters?: Map<string, RateLimiter> };

/** Returns the named process-wide limiter, creating it on first use. */
export function getLimiter(name: string, limit: number, windowMs: number): RateLimiter {
  const registry = (globalForLimiters.__connectwolLimiters ??= new Map());
  let limiter = registry.get(name);
  if (!limiter) {
    limiter = new RateLimiter(limit, windowMs);
    registry.set(name, limiter);
  }
  return limiter;
}

export function resetAllLimiters(): void {
  globalForLimiters.__connectwolLimiters?.forEach((l) => l.clear());
}
