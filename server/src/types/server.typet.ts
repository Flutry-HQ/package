import type { FastifyServerOptions } from 'fastify';
import type { ServerOptions } from 'socket.io';
import type { GlobalRateLimitOptions } from '../rate-limit/types';

/**
 * Configuration options for the Flutry HTTP server.
 *
 * Supports native Fastify configuration options alongside
 * Flutry-specific features.
 */
export interface HttpOptions extends Partial<FastifyServerOptions> {
  /**
   * Configures which reverse proxies Fastify should trust.
   *
   * Defaults to false.
   */
  trustProxy?: FastifyServerOptions['trustProxy'];

  /**
   * Configures Fastify logging.
   *
   * Defaults to false.
   */
  logger?: FastifyServerOptions['logger'];

  /**
   * Prefix applied to application routes.
   */
  prefix?: string;

  /**
   * Enables HTTP response compression.
   */
  compression?: boolean;

  /**
   * Enables Helmet security headers.
   */
  helmet?: boolean;

  /**
   * Enables Socket.IO with optional configuration.
   *
   * Set to false to disable Socket.IO.
   */
  socket?: false | Partial<ServerOptions>;

  /** Optional global HTTP rate limiting. Disabled by default. */
  rateLimit?: false | GlobalRateLimitOptions;
}
