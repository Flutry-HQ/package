import type { FastifyServerOptions } from 'fastify';
import { ServerOptions } from 'socket.io';

export interface HttpOptions extends Partial<FastifyServerOptions> {
  trustProxy: boolean;
  logger: boolean;
  prefix: string;
  compression: boolean;
  helmet: boolean;
  socket: false | Partial<ServerOptions>;
}
