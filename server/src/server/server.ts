import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import path from 'node:path';
import { registerPlugins } from './plugins';
import { registerLifecycle } from './lifecycle';
import { logger } from '@flutry/common';
import { RouteLoader } from '../router/loader';
import { HttpOptions } from '../types/server.typet';

import { registerSocket, Socket } from '../socket.io/socket.io';

export class HttpServer {
  private readonly startTime = performance.now();

  private readonly routeLoader: RouteLoader;

  public readonly app: FastifyInstance;
  public readonly socket: Socket | null;

  private readonly options: HttpOptions | null;

  public constructor(options: HttpOptions) {
    this.options = options;
    const fastifyOptions: FastifyServerOptions = {
      trustProxy: options.trustProxy ?? true,
      logger: options.logger ?? false,
    };

    this.app = Fastify(fastifyOptions);

    this.routeLoader = new RouteLoader(this.app, {
      directory: path.resolve(process.cwd(), 'src', 'routes'),

      prefix: options.prefix,
    });

    registerPlugins(this.app, options);

    this.socket = registerSocket(this.app, options);

    registerLifecycle(this.app, options);
  }

  public async listen(port: number, host = '0.0.0.0'): Promise<string> {
    /*
     * Routes must be registered before
     * Fastify starts accepting requests.
     */
    await this.routeLoader.load();

    const address = await this.app.listen({
      port,
      host,
    });

    const startupTime = performance.now() - this.startTime;
    logger.info(`===============================================`);
    logger.info(`🚀 Flutry Server v${process.env.npm_package_version ?? 'unknown'}`);
    logger.info(`-----------------------------------------------`);
    logger.info(`📦 Environment: ${process.env.NODE_ENV ?? 'development'}`);
    logger.info(`🌐 Address: ${address}`);
    logger.info(`⏰ Startup: ${startupTime.toFixed(2)}ms`);
    logger.info(`🛡️ Trust Proxy: ${this.options?.trustProxy ?? false}`);

    if (this.socket?.isRunning) {
      logger.info(`🔌 Socket.IO: RUNNING`);
    } else {
      logger.info(`🔌 Socket.IO: DISABLED`);
    }
    logger.info(`-----------------------------------------------`);

    logger.info(`===============================================`);
    return address;
  }

  public async close(): Promise<void> {
    await this.app.close();
  }
}
