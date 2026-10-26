import { createHash } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { Ctx } from '../router/context';
import { RateLimitExceededError, RateLimitUnavailableError } from './errors';
import { MemoryRateLimitStore } from './memory-store';
import { normalizeRateLimitOptions } from './options';
import { acquireRedis, releaseRedis } from './redis-store';
import type { RateLimitCounter, RateLimitOptions, RateLimitResult } from './types';

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

/** A reusable, fixed-window rule. Rejections stop an awaited route handler. */
export class RateLimit {
  private readonly options;
  private readonly memory: MemoryRateLimitStore | undefined;
  private readonly namespace: string;
  private readonly owner = Symbol('RateLimit');
  private readonly requests = new WeakMap<FastifyRequest, Promise<RateLimitResult>>();
  private redisReady: ReturnType<typeof acquireRedis> | undefined;
  private closePromise: Promise<void> | undefined;
  private closed = false;

  constructor(options: RateLimitOptions = {}) {
    this.options = normalizeRateLimitOptions(options);
    this.namespace = `flutry:rate-limit:v1:${hash(this.options.name ?? 'memory')}:`;
    this.memory = this.options.redis ? undefined : new MemoryRateLimitStore(this.options.max, this.options.windowMilliseconds, this.options.maxStoreSize);
  }

  /** Optional for route rules; global Redis rules connect in Fastify's onReady hook. */
  public async connect(): Promise<void> {
    this.assertOpen();

    if (this.options.redis) {
      try {
        await this.withDeadline((async () => {
          const client = await this.getRedis();
          this.assertOpen();
          if (client.getConnectionStatus().status !== 'ready') {
            await client.connect();
          }
        })());
        this.assertOpen();
      } catch (error) {
        throw new RateLimitUnavailableError(error);
      }
    }
  }

  /** Each rule consumes quota at most once per Fastify request, including concurrent calls. */
  public async handle(ctx: Ctx): Promise<RateLimitResult> {
    this.assertOpen();
    const existing = this.requests.get(ctx.req);
    if (existing) return existing;

    const operation = this.consume(ctx);
    this.requests.set(ctx.req, operation);
    return operation;
  }

  public close(): Promise<void> {
    if (this.closePromise) return this.closePromise;

    this.closed = true;
    this.memory?.clear();
    this.closePromise = (async () => {
      await this.redisReady?.catch(() => {});
      await releaseRedis(this.owner);
    })();

    return this.closePromise;
  }

  private async consume(ctx: Ctx): Promise<RateLimitResult> {
    try {
      this.assertOpen();

      const skipped = this.options.skip ? await this.options.skip(ctx) : false;

      if (typeof skipped !== 'boolean') {
        throw new TypeError('RateLimit skip must return a boolean');
      }

      if (skipped) {
        this.assertOpen();
        return { allowed: true, limit: this.options.max, remaining: this.options.max, reset: 0 };
      }

      const identity = this.options.keyGenerator ? await this.options.keyGenerator(ctx) : ctx.req.ip || 'unknown';
      this.assertOpen();

      if (typeof identity !== 'string' || !identity.trim() || Buffer.byteLength(identity) > 4096) {
        throw new TypeError('RateLimit client key must contain 1–4,096 UTF-8 bytes');
      }

      const key = this.namespace + hash(identity);
      let counter: RateLimitCounter;

      if (this.memory) {
        counter = this.memory.consume(key);
      } else {
        counter = await this.withDeadline((async () => {
          const client = await this.getRedis();
          this.assertOpen();
          return client.consumeRateLimit(key, this.options.max, this.options.windowMilliseconds);
        })());
      }

      this.assertOpen();

      const remaining = Math.max(0, this.options.max - counter.count);
      const reset = Math.max(1, Math.ceil(counter.ttlMilliseconds / 1000));

      ctx.setHeader('RateLimit-Limit', String(this.options.max));
      ctx.setHeader('RateLimit-Remaining', String(remaining));
      ctx.setHeader('RateLimit-Reset', String(reset));

      if (!counter.allowed) {
        ctx.setHeader('Retry-After', String(reset));
        throw new RateLimitExceededError(reset);
      }

      return { allowed: true, limit: this.options.max, remaining, reset };
    } catch (error) {
      if (error instanceof RateLimitExceededError || error instanceof RateLimitUnavailableError) throw error;
      throw new RateLimitUnavailableError(error);
    }
  }

  private getRedis(): ReturnType<typeof acquireRedis> {
    if (!this.redisReady) {
      const operation = acquireRedis(this.owner);
      this.redisReady = operation;
      void operation.catch(() => {
        if (this.redisReady === operation) this.redisReady = undefined;
      });
    }

    return this.redisReady;
  }

  private withDeadline<T>(operation: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('RateLimit Redis operation timed out')), this.options.redisTimeoutMs);
      void operation.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private assertOpen(): void {
    if (this.closed) throw new RateLimitUnavailableError(new Error('RateLimit is closed'));
  }
}
