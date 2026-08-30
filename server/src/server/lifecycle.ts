import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { logger } from '@flutry/common';
import { HttpOptions } from '../types/server.typet';

/**
 * Registers the HTTP lifecycle hooks used by Flutry.
 *
 * Currently, the lifecycle system registers an `onRequest`
 * hook which measures and logs the duration of each HTTP request.
 *
 * @param app Fastify application instance.
 * @param _options Flutry HTTP server configuration.
 */
export function registerLifecycle(app: FastifyInstance, _options: HttpOptions): void {
  /**
   * Register the request lifecycle hook.
   *
   * This hook runs before the request is handled by
   * the matching route.
   */
  app.addHook('onRequest', onRequest);
}

/**
 * Handles the beginning of an incoming HTTP request.
 *
 * The request start time is stored using `performance.now()`.
 * Once the response has finished, the total request duration
 * and response status code are written to the Flutry logger.
 *
 * The favicon request is ignored to prevent unnecessary
 * request logs.
 *
 * @param request Incoming Fastify request.
 * @param reply Fastify response instance.
 */
async function onRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  /**
   * Ignore browser favicon requests.
   *
   * Browsers commonly request `/favicon.ico` automatically,
   * so logging these requests would create unnecessary noise.
   */
  if (request.raw.url === '/favicon.ico') {
    return;
  }

  /**
   * Store the request start time so the total processing
   * duration can be calculated once the response finishes.
   */
  const start = performance.now();

  /**
   * `finish` is emitted when the HTTP response has been
   * completely sent to the client.
   *
   * At this point the request duration and final HTTP
   * status code are available.
   */
  reply.raw.once('finish', () => {
    const duration = performance.now() - start;

    logger.http(`http ${request.method} ${request.raw.url} ` + `${duration.toFixed(2)}ms ${reply.statusCode}`);
  });
}
