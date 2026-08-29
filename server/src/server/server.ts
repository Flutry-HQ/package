import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import path from 'node:path';
import { registerPlugins } from './plugins';
import { registerLifecycle } from './lifecycle';
import { logger } from '@flutry/common';
import { RouteLoader } from '../router/loader';
import { HttpOptions } from '../types/server.typet';

export class HttpServer {
  private readonly startTime = performance.now();

  private readonly routeLoader: RouteLoader;

  public readonly app: FastifyInstance;

  public constructor(
    options: HttpOptions = {
      prefix: '',
    },
  ) {
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
    logger.info(`=====================================`);
    logger.info(`🚀 Flutry Server ${process.env.NODE_ENV}`);
    logger.info(`⏰ Start Time: ${startupTime.toFixed(2)}ms`);
    logger.info(`🌐 ${address}`);
    logger.info(`=====================================`);
    return address;
  }

  public async close(): Promise<void> {
    await this.app.close();
  }
}
