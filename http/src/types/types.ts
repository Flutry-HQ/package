import type { FastifyServerOptions } from 'fastify';

export interface HttpOptions extends Partial<FastifyServerOptions> {
  trustProxy?: boolean;
  logger?: boolean;
  prefix: string;
  compression?: boolean;
  helmet?: boolean;
}
