import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '@flutry/common';
import { HttpOptions } from '../types/server.typet';

export function registerLifecycle(app: FastifyInstance, _options: HttpOptions): void {
  app.addHook('onRequest', onRequest);
}

async function onRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.raw.url === '/favicon.ico') {
    return;
  }

  const start = performance.now();

  reply.raw.once('finish', () => {
    const duration = performance.now() - start;
    logger.http(`http ${request.method} ${request.raw.url} ${duration.toFixed(2)}ms ${reply.statusCode}`);
  });
}
