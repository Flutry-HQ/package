import { logger } from '@flutry/common';
import { Redis } from 'ioredis';

class RedisService {
  private client: Redis | null = null;

  /** Első híváskor létrehozza a kapcsolatot, utána mindig ugyanazt adja vissza. */
  private getClient(): Redis {
    if (this.client) {
      return this.client;
    }

    const client = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD,
    });

    client.on('connect', () => logger.info('Redis connected successfully'));
    client.on('ready', () => logger.info('Redis is ready'));
    client.on('error', (error: Error) => logger.error(`Redis connection error: ${error.message}`));
    client.on('close', () => logger.warn('Redis connection closed'));
    client.on('reconnecting', () => logger.warn('Redis reconnecting...'));

    this.client = client;
    return client;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const result = await this.getClient().get(this.prefix(key));

    if (result === null) {
      return null;
    }

    return JSON.parse(result) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<'OK'> {
    const serialized = JSON.stringify(value);

    if (ttlSeconds !== undefined) {
      return this.getClient().set(this.prefix(key), serialized, 'EX', ttlSeconds);
    }

    return this.getClient().set(this.prefix(key), serialized);
  }

  async delete(key: string): Promise<number> {
    return this.getClient().del(this.prefix(key));
  }

  async exists(key: string): Promise<boolean> {
    return (await this.getClient().exists(this.prefix(key))) === 1;
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return (await this.getClient().expire(this.prefix(key), ttlSeconds)) === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.getClient().ttl(this.prefix(key));
  }

  getConnectionStatus() {
    return {
      connected: this.client?.status === 'ready',
      status: this.client?.status ?? 'not_initialized',
      mode: 'single',
    };
  }

  async disconnect(): Promise<void> {
    if (this.client && this.client.status !== 'end') {
      await this.client.quit();
    }
    this.client = null;
  }

  private prefix(key: string): string {
    return `${process.env.REDIS_PREFIX ?? ''}${key}`;
  }
}

export const redis = new RedisService();
