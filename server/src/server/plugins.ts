import { type FastifyInstance } from 'fastify';

import compression from '@fastify/compress';
import helmet from '@fastify/helmet';

import { HttpOptions } from '../types/server.typet';

/**
 * Registers the built-in Flutry Fastify plugins.
 *
 * The plugins are enabled by default and can be disabled
 * individually through the HttpServer options.
 *
 * Currently supported plugins:
 *
 * - Compression — compresses HTTP responses to reduce payload size.
 * - Helmet — adds common HTTP security headers.
 *
 * @param app Fastify application instance.
 * @param options Flutry HTTP server configuration.
 */
export function registerPlugins(app: FastifyInstance, options: HttpOptions): void {
  /**
   * Register response compression unless explicitly disabled.
   */
  if (options.compression !== false) {
    app.register(compression);
  }

  /**
   * Register Helmet security headers unless explicitly disabled.
   */
  if (options.helmet !== false) {
    app.register(helmet);
  }
}
