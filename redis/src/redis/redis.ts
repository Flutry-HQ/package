import { logger } from '@flutry/common';
import { Redis } from 'ioredis';
import { RATE_LIMIT_SCRIPT, type RedisRateLimitResult } from './rate-limit';

class RedisService {
  private client: Redis | null = null;
  private connectionPromise: Promise<void> | null = null;
  private disconnectPromise: Promise<void> | null = null;

  private static readonly CONNECT_TIMEOUT = 10000;
  private static readonly COMMAND_TIMEOUT = 5000;
  private static readonly QUIT_TIMEOUT = 2000;

  /**
   * Rejects if an operation exceeds its deadline.
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Redis ${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      void promise.then(
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

  /**
   * Creates the Redis client lazily.
   */
  private getClient(): Redis {
    if (this.client) {
      return this.client;
    }

    const client = new Redis({
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,

      lazyConnect: true,
      connectTimeout: RedisService.CONNECT_TIMEOUT,
      commandTimeout: RedisService.COMMAND_TIMEOUT,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,

      retryStrategy(times) {
        return Math.min(times * 200, 3000);
      },
    });

    client.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    client.on('ready', () => {
      logger.info('Redis is ready');
    });

    client.on('error', (error: Error) => {
      logger.error(`Redis connection error: ${error.message}`);
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    client.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    this.client = client;

    return client;
  }

  /**
   * Waits for the client to become ready.
   */
  private waitUntilReady(client: Redis): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        client.off('ready', onReady);
        client.off('end', onEnd);
      };

      const onReady = () => {
        cleanup();
        resolve();
      };

      const onEnd = () => {
        cleanup();
        reject(new Error('Redis connection ended'));
      };

      client.once('ready', onReady);
      client.once('end', onEnd);

      if (client.status === 'ready') {
        onReady();
      } else if (client.status === 'end') {
        onEnd();
      }
    });
  }

  /**
   * Connects to Redis with a bounded readiness wait.
   *
   * Concurrent calls share the same promise.
   */
  public async connect(): Promise<void> {
    if (this.disconnectPromise) {
      await this.disconnectPromise;
    }

    const client = this.getClient();

    if (client.status === 'ready') {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    const operation = (async () => {
      if (client.status === 'wait') {
        await this.withTimeout(client.connect(), RedisService.CONNECT_TIMEOUT, 'connection');
      } else if (client.status === 'connect' || client.status === 'connecting' || client.status === 'reconnecting') {
        await this.withTimeout(this.waitUntilReady(client), RedisService.CONNECT_TIMEOUT, 'readiness');
      } else {
        throw new Error(`Redis connection is not available: ${client.status}`);
      }

      if (this.client !== client) {
        throw new Error('Redis client changed during connection');
      }

      // The status can change during the awaited handshake.
      if (!this.getConnectionStatus().connected) {
        throw new Error('Redis is not ready');
      }
    })();

    this.connectionPromise = operation;

    try {
      await operation;
    } catch (error) {
      if (this.client === client) {
        this.client = null;
        client.disconnect();
      }

      throw error;
    } finally {
      if (this.connectionPromise === operation) {
        this.connectionPromise = null;
      }
    }
  }

  /**
   * Returns the ready Redis client.
   */
  private async getReadyClient(): Promise<Redis> {
    await this.connect();

    const client = this.client;

    if (!client || client.status !== 'ready') {
      throw new Error('Redis is not ready');
    }

    return client;
  }

  /**
   * Validates Redis expiration values.
   */
  private validateTTL(ttlSeconds: number): void {
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new RangeError('Redis TTL must be a positive integer');
    }
  }

  /**
   * Serializes a value to JSON.
   */
  private serialize<T>(value: T): string {
    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
      throw new TypeError('Redis value cannot be serialized to JSON');
    }

    return serialized;
  }

  /**
   * Retrieves and parses a JSON value.
   */
  public async get<T = unknown>(key: string): Promise<T | null> {
    const client = await this.getReadyClient();
    const result = await client.get(this.prefix(key));

    return result === null ? null : (JSON.parse(result) as T);
  }

  /**
   * Stores a JSON value with an optional TTL.
   */
  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<'OK'> {
    const serialized = this.serialize(value);

    if (ttlSeconds !== undefined) {
      this.validateTTL(ttlSeconds);
    }

    const client = await this.getReadyClient();

    if (ttlSeconds !== undefined) {
      return client.set(this.prefix(key), serialized, 'EX', ttlSeconds);
    }

    return client.set(this.prefix(key), serialized);
  }

  /**
   * Deletes a key.
   */
  public async delete(key: string): Promise<number> {
    const client = await this.getReadyClient();

    return client.del(this.prefix(key));
  }

  /**
   * Checks whether a key exists.
   */
  public async exists(key: string): Promise<boolean> {
    const client = await this.getReadyClient();

    return (await client.exists(this.prefix(key))) === 1;
  }

  /**
   * Sets an expiration time.
   */
  public async expire(key: string, ttlSeconds: number): Promise<boolean> {
    this.validateTTL(ttlSeconds);

    const client = await this.getReadyClient();

    return (await client.expire(this.prefix(key), ttlSeconds)) === 1;
  }

  /**
   * Returns the remaining TTL in seconds.
   */
  public async ttl(key: string): Promise<number> {
    const client = await this.getReadyClient();

    return client.ttl(this.prefix(key));
  }

  /**
   * Atomically consumes one fixed-window quota slot. Uses a dedicated numeric
   * key; do not mix these keys with the JSON get/set API. No automatic retries
   * are performed here because an interrupted write may already have executed.
   */
  public async consumeRateLimit(key: string, max: number, windowMilliseconds: number): Promise<RedisRateLimitResult> {
    if (typeof key !== 'string' || !key || Buffer.byteLength(key) > 1024) {
      throw new TypeError('Redis rate limit key must contain 1–1,024 UTF-8 bytes');
    }

    if (!Number.isSafeInteger(max) || max <= 0 || !Number.isSafeInteger(windowMilliseconds) || windowMilliseconds <= 0) {
      throw new RangeError('Redis rate limit max and windowMilliseconds must be positive safe integers');
    }

    const client = await this.getReadyClient();
    const result = await client.eval(RATE_LIMIT_SCRIPT, 1, this.prefix(key), windowMilliseconds, max);

    if (!Array.isArray(result) || result.length !== 3) {
      throw new Error('Invalid Redis rate limit response');
    }

    const [allowed, count, ttlMilliseconds]: unknown[] = result;

    if (
      (allowed !== 0 && allowed !== 1) ||
      typeof count !== 'number' ||
      !Number.isSafeInteger(count) ||
      count < 1 ||
      typeof ttlMilliseconds !== 'number' ||
      !Number.isSafeInteger(ttlMilliseconds) ||
      ttlMilliseconds < 0
    ) {
      throw new Error('Invalid Redis rate limit response');
    }

    return { allowed: allowed === 1, count, ttlMilliseconds };
  }

  /**
   * Returns the Redis connection status.
   */
  public getConnectionStatus() {
    return {
      connected: this.client?.status === 'ready',
      status: this.client?.status ?? 'not_initialized',
      mode: 'single',
    };
  }

  /**
   * Gracefully disconnects the Redis client.
   *
   * Concurrent calls share the same shutdown operation.
   */
  public async disconnect(): Promise<void> {
    if (this.disconnectPromise) {
      return this.disconnectPromise;
    }

    const client = this.client;

    if (!client) {
      return;
    }

    const operation = (async () => {
      if (this.connectionPromise) {
        await this.connectionPromise.catch(() => {});
      }

      if (client.status === 'ready') {
        try {
          await this.withTimeout(client.quit(), RedisService.QUIT_TIMEOUT, 'shutdown');
        } catch (error) {
          logger.warn(`Redis graceful shutdown failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      client.disconnect();

      if (this.client === client) {
        this.client = null;
      }
    })();

    this.disconnectPromise = operation;

    try {
      await operation;
    } finally {
      if (this.disconnectPromise === operation) {
        this.disconnectPromise = null;
      }
    }
  }

  /**
   * Applies the configured key prefix.
   */
  private prefix(key: string): string {
    return `${process.env.REDIS_PREFIX ?? ''}${key}`;
  }
}

export const redis = new RedisService();
