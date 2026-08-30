import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import path from 'node:path';

import { registerPlugins } from './plugins';
import { registerLifecycle } from './lifecycle';
import { logger } from '@flutry/common';
import { RouteLoader } from '../router/loader';
import { HttpOptions } from '../types/server.typet';

import { registerSocket, Socket } from '../socket.io/socket.io';

/**
 * Main HTTP server implementation for the Flutry framework.
 *
 * HttpServer is responsible for:
 *
 * - Creating and configuring the Fastify application.
 * - Registering framework plugins.
 * - Loading application routes.
 * - Initializing Socket.IO when enabled.
 * - Registering server lifecycle handlers.
 * - Starting and stopping the HTTP server.
 * - Logging server startup information.
 *
 * A single HttpServer instance should normally be created
 * for each Flutry application.
 */
export class HttpServer {
  /**
   * Timestamp captured when the HttpServer instance is created.
   *
   * Used to calculate the total application startup time.
   */
  private readonly startTime = performance.now();

  /**
   * Route loader responsible for discovering and registering
   * application routes from the project's routes directory.
   */
  private readonly routeLoader: RouteLoader;

  /**
   * Underlying Fastify application instance.
   *
   * This can be used to access Fastify directly when framework-level
   * functionality is not sufficient.
   */
  public readonly app: FastifyInstance;

  /**
   * Socket.IO wrapper instance.
   *
   * Will be null when Socket.IO has been disabled through
   * the HttpServer options.
   */
  public readonly socket: Socket | null;

  /**
   * HTTP server configuration used to initialize this instance.
   */
  private readonly options: HttpOptions | null;

  /**
   * Creates and configures a new Flutry HTTP server.
   *
   * During construction the following components are initialized:
   *
   * - Fastify
   * - Route loader
   * - Framework plugins
   * - Socket.IO
   * - Lifecycle handlers
   *
   * Routes themselves are loaded later when listen() is called.
   *
   * @param options HTTP server configuration.
   */
  public constructor(options: HttpOptions) {
    this.options = options;

    /**
     * Convert Flutry HTTP options into Fastify server options.
     */
    const fastifyOptions: FastifyServerOptions = {
      trustProxy: options.trustProxy ?? true,
      logger: options.logger ?? false,
    };

    /**
     * Create the underlying Fastify application.
     */
    this.app = Fastify(fastifyOptions);

    /**
     * Initialize the route loader.
     *
     * Routes are automatically discovered from:
     *
     * <project>/src/routes
     */
    this.routeLoader = new RouteLoader(this.app, {
      directory: path.resolve(process.cwd(), 'src', 'routes'),

      prefix: options.prefix,
    });

    /**
     * Register all framework-level plugins.
     */
    registerPlugins(this.app, options);

    /**
     * Initialize Socket.IO when it is enabled.
     *
     * The Socket instance is stored on the HttpServer so
     * applications can access it through server.socket.
     */
    this.socket = registerSocket(this.app, options);

    /**
     * Register Fastify lifecycle handlers.
     */
    registerLifecycle(this.app, options);
  }

  /**
   * Starts the Flutry HTTP server.
   *
   * Routes are loaded before Fastify starts accepting requests.
   * After the server starts successfully, startup information
   * is written to the Flutry logger.
   *
   * @param port Port the HTTP server should listen on.
   * @param host Host/interface the HTTP server should bind to.
   *
   * @returns The address assigned by Fastify after successful startup.
   *
   * @throws If route loading or server startup fails.
   */
  public async listen(port: number, host = '0.0.0.0'): Promise<string> {
    /*
     * Routes must be registered before Fastify starts
     * accepting incoming requests.
     */
    await this.routeLoader.load();

    /**
     * Start the underlying Fastify HTTP server.
     */
    const address = await this.app.listen({
      port,
      host,
    });

    /**
     * Calculate how long the server took to start.
     */
    const startupTime = performance.now() - this.startTime;

    /**
     * Log server startup information.
     */
    logger.info(`===============================================`);

    logger.info(`🚀 Flutry Server v${process.env.npm_package_version ?? 'unknown'}`);

    logger.info(`-----------------------------------------------`);

    logger.info(`📦 Environment: ${process.env.NODE_ENV ?? 'development'}`);

    logger.info(`🌐 Address: ${address}`);

    logger.info(`⏰ Startup: ${startupTime.toFixed(2)}ms`);

    logger.info(`🛡️ Trust Proxy: ${this.options?.trustProxy ?? false}`);

    /**
     * Report the current Socket.IO state.
     */
    if (this.socket?.isRunning) {
      logger.info(`🔌 Socket.IO: RUNNING`);
    } else {
      logger.info(`🔌 Socket.IO: DISABLED`);
    }

    logger.info(`-----------------------------------------------`);

    logger.info(`===============================================`);

    return address;
  }

  /**
   * Gracefully shuts down the HTTP server.
   *
   * Fastify closes the underlying server and executes
   * registered shutdown lifecycle handlers.
   *
   * Socket.IO is also closed as part of its registered
   * lifecycle handling.
   *
   * @throws If the Fastify server cannot be closed cleanly.
   */
  public async close(): Promise<void> {
    await this.app.close();
  }
}
