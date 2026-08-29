import { logger } from '@flutry/common';
import Redis, { Cluster } from 'ioredis';

/**
 * Configuration options for the Redis client.
 */
interface RedisConfig {
  /** Redis server hostname. */
  host?: string;

  /** Redis server port. */
  port?: number;

  /** Redis authentication password. */
  password?: string;

  /** Delay between Redis failover retries in milliseconds. */
  retryDelayOnFailover?: number;

  /** Enables Redis ready-check handling. */
  enableReadyCheck?: boolean;

  /** Maximum number of retries for a single request. */
  maxRetriesPerRequest?: number;

  /** Delays the initial Redis connection until explicitly requested. */
  lazyConnect?: boolean;
}

/**
 * Redis service for storing and retrieving application data.
 *
 * The service provides a simple abstraction over ioredis and handles
 * connection management, automatic reconnection, key prefixes,
 * serialization, and basic Redis operations.
 */
class RedisService {
  /** Active Redis client instance. */
  private client: Redis | Cluster | null = null;

  /** Indicates whether the Redis connection is currently active. */
  private isConnected: boolean = false;

  /**
   * Creates a new Redis service and initializes the connection.
   */
  constructor() {
    this.connect();
  }

  /**
   * Establishes a connection to the configured Redis server.
   *
   * Connection settings are read from environment variables:
   *
   * - `REDIS_HOST`
   * - `REDIS_PORT`
   * - `REDIS_PASSWORD`
   */
  private async connect(): Promise<void> {
    try {
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = parseInt(process.env.REDIS_PORT || '6379');
      const redisPassword = process.env.REDIS_PASSWORD;

      const redisConfig: RedisConfig = {
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        lazyConnect: true,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
      };

      this.client = new Redis(redisConfig);

      logger.info(`Connecting to Redis: ${redisHost}:${redisPort}`);

      this.client.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('error', (error: any) => {
        logger.error('Redis connection error:', error.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.info('Redis connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Ensures that a Redis client is available and connected.
   *
   * @throws Error when Redis is not connected.
   */
  private ensureConnection(): void {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis is not connected');
    }
  }

  /**
   * Retrieves a value from Redis.
   *
   * Values are automatically parsed from JSON.
   *
   * @param key Redis key.
   * @returns The stored value or `null` when the key does not exist.
   */
  async get(key: string): Promise<any | null> {
    try {
      this.ensureConnection();

      const result = await this.client!.get(`${process.env.REDIS_PREFIX || ''}${key}`);

      return result ? JSON.parse(result) : null;
    } catch (error) {
      logger.error('Redis GET error:', error);
      throw error;
    }
  }

  /**
   * Stores a value in Redis.
   *
   * Values are automatically serialized to JSON.
   *
   * @param key Redis key.
   * @param value Value to store.
   * @param ttlSeconds Optional expiration time in seconds.
   * @returns Redis `OK` response.
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<'OK'> {
    try {
      this.ensureConnection();

      const jsonString = JSON.stringify(value);

      if (ttlSeconds) {
        return await this.client!.set(`${process.env.REDIS_PREFIX || ''}${key}`, jsonString, 'EX', ttlSeconds);
      }

      return await this.client!.set(`${process.env.REDIS_PREFIX || ''}${key}`, jsonString);
    } catch (error) {
      logger.error('Redis SET error:', error);
      throw error;
    }
  }

  /**
   * Deletes a value from Redis.
   *
   * @param key Redis key.
   * @returns Number of keys removed.
   */
  async delete(key: string): Promise<number> {
    try {
      this.ensureConnection();

      return await this.client!.del(`${process.env.REDIS_PREFIX || ''}${key}`);
    } catch (error) {
      logger.error('Redis DELETE error:', error);
      throw error;
    }
  }

  /**
   * Closes the Redis connection.
   *
   * The active client is removed after disconnecting.
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.disconnect();

        this.client = null;
        this.isConnected = false;

        logger.info('Redis disconnected');
      }
    } catch (error) {
      logger.error('Redis disconnect error:', error);
      throw error;
    }
  }
}

/**
 * Shared Redis service instance.
 *
 * This instance is created automatically when the package is imported.
 */
const redisService = new RedisService();

export { RedisService, redisService };
