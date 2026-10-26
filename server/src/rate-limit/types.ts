import type { Ctx } from '../router/context';

export type RateLimitKeyGenerator = (ctx: Ctx) => string | Promise<string>;
export type RateLimitSkip = (ctx: Ctx) => boolean | Promise<boolean>;

export interface RateLimitOptions {
  /** Maximum admitted requests per client and window. Defaults to 100. */
  max?: number;
  /** Fixed window duration in whole seconds. Defaults to 60. */
  window?: number;
  /** Use the optional @flutry/redis singleton. Defaults to false. */
  redis?: boolean;
  /** Stable, application-specific rule name. Required in Redis mode. */
  name?: string;
  /** Maximum active clients per memory limiter. Defaults to 10,000. */
  maxStoreSize?: number;
  /** Deadline for Redis initialization and each operation, in milliseconds. Defaults to 5,000. */
  redisTimeoutMs?: number;
  /** Defaults to ctx.req.ip. Results must contain 1–4,096 UTF-8 bytes. */
  keyGenerator?: RateLimitKeyGenerator;
  /** Explicitly exempt a request without consuming quota or setting headers. */
  skip?: RateLimitSkip;
}

export interface GlobalRateLimitOptions extends RateLimitOptions {
  /** Global limiting is disabled unless this is true. */
  enabled?: boolean;
  /** Exact URL path exclusions, ignoring queries. Defaults to /health and /favicon.ico. */
  exclude?: readonly string[];
}

export interface RateLimitResult {
  allowed: true;
  limit: number;
  remaining: number;
  /** Seconds until this client's window resets, rounded up. */
  reset: number;
}

export interface RateLimitCounter {
  allowed: boolean;
  count: number;
  ttlMilliseconds: number;
}
