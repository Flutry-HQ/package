import { type FastifyInstance } from 'fastify';

import compression from '@fastify/compress';
import helmet from '@fastify/helmet';
import { HttpOptions } from '../types/server.typet';
export function registerPlugins(app: FastifyInstance, options: HttpOptions): void {
  if (options.compression !== false) {
    app.register(compression);
  }

  if (options.helmet !== false) {
    app.register(helmet);
  }
}
