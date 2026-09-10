import { logger } from '@flutry/common';
import { Redis } from 'ioredis';

export class RedisService {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: false,
    });

    this.client.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.client.on('ready', () => {
      logger.info('Redis is ready');
    });

    this.client.on('error', (error: Error) => {
      logger.error(`Redis connection error: ${error.message}`);
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const result = await this.client.get(this.prefix(key));

    if (result === null) {
      return null;
    }

    return JSON.parse(result) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<'OK'> {
    const serialized = JSON.stringify(value);

    if (ttlSeconds !== undefined) {
      return this.client.set(this.prefix(key), serialized, 'EX', ttlSeconds);
    }

    return this.client.set(this.prefix(key), serialized);
  }

  async delete(key: string): Promise<number> {
    return this.client.del(this.prefix(key));
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(this.prefix(key))) === 1;
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return (await this.client.expire(this.prefix(key), ttlSeconds)) === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(this.prefix(key));
  }

  getConnectionStatus() {
    return {
      connected: this.client.status === 'ready',
      status: this.client.status,
      mode: 'single',
    };
  }

  async disconnect(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }

  private prefix(key: string): string {
    return `${process.env.REDIS_PREFIX ?? ''}${key}`;
  }
}
