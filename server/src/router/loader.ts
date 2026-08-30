import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { logger } from '@flutry/common';
import { Router } from './router';
import { FastifyInstance, type FastifyError } from 'fastify';
import { RouteLoaderOptions } from '../types/router.types';

/**
 * Automatically discovers and registers Flutry routes.
 *
 * RouteLoader scans the configured routes directory recursively
 * and loads files following the `.route.ts` naming convention.
 *
 * Example:
 *
 * routes/
 * ├── index.route.ts
 * ├── users/
 * │   ├── index.route.ts
 * │   └── profile.route.ts
 * └── users/
 *     └── $id.route.ts
 *
 * Dynamic route parameters can be defined using `$`:
 *
 * `$id.route.ts` → `:id`
 *
 * Routes must export a class as their default export and
 * that class must extend the Flutry Router class.
 */
export class RouteLoader {
  /**
   * Indicates whether the routes have already been loaded.
   *
   * Prevents the same route files from being registered
   * multiple times.
   */
  private loaded = false;

  /**
   * Creates a new RouteLoader.
   *
   * @param app Fastify application instance.
   * @param options Route loader configuration.
   */
  public constructor(
    private readonly app: FastifyInstance,
    private readonly options: RouteLoaderOptions,
  ) {}

  /**
   * Loads all application routes.
   *
   * The routes directory is scanned recursively and all
   * matching `.route.ts` files are imported and registered.
   *
   * System routes and error handlers are registered after
   * application routes have been loaded.
   *
   * Calling this method more than once has no effect.
   *
   * @throws If the routes directory cannot be read.
   * @throws If a route module is invalid.
   */
  public async load(): Promise<void> {
    /**
     * Do not load routes more than once.
     */
    if (this.loaded) {
      return;
    }

    logger.info(`===============================================`);

    /**
     * Resolve the configured routes directory to an
     * absolute filesystem path.
     */
    const directory = path.resolve(this.options.directory);

    /**
     * Recursively scan and load all route files.
     */
    await this.scan(directory, '');

    /**
     * Register framework-provided system handlers
     * after all application routes have been discovered.
     */
    this.registerSystemHandlers();

    /**
     * Mark route loading as completed.
     */
    this.loaded = true;
  }

  /**
   * Recursively scans a directory for route files.
   *
   * Directories are scanned recursively while files ending
   * with `.route.ts` are loaded as application routes.
   *
   * @param directory Absolute directory path to scan.
   * @param basePath Route path relative to the routes root.
   */
  private async scan(directory: string, basePath: string): Promise<void> {
    /**
     * Read all directory entries while preserving information
     * about whether each entry is a file or directory.
     */
    const entries = await readdir(directory, {
      withFileTypes: true,
    });

    const tasks: Promise<void>[] = [];

    /**
     * Process all directory entries.
     *
     * Route loading is performed concurrently using Promise.all()
     * after all tasks have been collected.
     */
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      const filePath = path.join(directory, entry.name);

      /**
       * Recursively scan nested directories.
       */
      if (entry.isDirectory()) {
        tasks.push(this.scan(filePath, path.join(basePath, entry.name)));

        continue;
      }

      /**
       * Only files following the `.route.ts` convention
       * are treated as application routes.
       */
      if (entry.isFile() && entry.name.endsWith('.route.ts')) {
        tasks.push(this.loadRoute(filePath, basePath, entry.name));
      }
    }

    /**
     * Wait for all discovered routes and directories
     * to finish loading.
     */
    await Promise.all(tasks);
  }

  /**
   * Imports and registers a single route module.
   *
   * The module must have a default export containing a class
   * that extends the Flutry Router class.
   *
   * @param filePath Absolute path to the route file.
   * @param routeBasePath Directory path relative to the routes root.
   * @param fileName Route file name.
   *
   * @throws If the route has no default export.
   * @throws If the default export does not extend Router.
   */
  private async loadRoute(filePath: string, routeBasePath: string, fileName: string): Promise<void> {
    /**
     * Import the route module using a file URL so it works
     * correctly with Node.js ESM module resolution.
     */
    const module = await import(pathToFileURL(filePath).href);

    /**
     * The default export represents the route class.
     */
    const RouteClass = module.default;

    if (!RouteClass) {
      throw new Error(`Route "${filePath}" has no default export.`);
    }

    /**
     * Create an instance of the route class.
     */
    const route = new RouteClass();

    /**
     * Ensure that the exported class is a valid
     * Flutry Router implementation.
     */
    if (!(route instanceof Router)) {
      throw new TypeError(`Route "${filePath}" must extend Router.`);
    }

    /**
     * Resolve the URL prefix based on the route's
     * directory structure and file name.
     */
    const prefix = this.resolvePrefix(routeBasePath, fileName);

    /**
     * Register the route plugin with Fastify.
     */
    await this.app.register(route.plugin(), {
      prefix,
    });

    /**
     * Route loading information is only logged outside
     * production environments to avoid unnecessary log noise.
     */
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`Loaded route: ${prefix}`);
    }
  }

  /**
   * Converts a route file and directory structure into
   * its corresponding HTTP path.
   *
   * Examples:
   *
   * `routes/index.route.ts`
   * → `/`
   *
   * `routes/users/user.route.ts`
   * → `/users`
   *
   * `routes/users/profile.route.ts`
   * → `/users/profile`
   *
   * `routes/users/$id.route.ts`
   * → `/users/:id`
   *
   * @param routeBasePath Route directory relative to the routes root.
   * @param fileName Route file name.
   *
   * @returns Resolved route prefix.
   */
  private resolvePrefix(routeBasePath: string, fileName: string): string {
    /**
     * Remove the `.route.ts` suffix from the file name.
     */
    const routeName = fileName.replace(/\.route\.ts$/, '');

    /*
     * Only:
     *
     * routes/index.route.ts
     *
     * represents "/".
     */
    if (routeBasePath === '' && routeName === 'index') {
      return this.applyGlobalPrefix('/');
    }

    /**
     * Normalize Windows path separators so route paths
     * always use `/`.
     */
    const normalizedBasePath = routeBasePath.replace(/\\/g, '/');

    /**
     * Create the initial route path from the directory.
     */
    let prefix = path.posix.join('/', normalizedBasePath);

    /*
     * routes/users/user.route.ts
     * → /users
     *
     * routes/users/profile.route.ts
     * → /users/profile
     *
     * When the route name matches the directory name,
     * the file name is not duplicated in the URL.
     */
    if (routeName !== path.posix.basename(normalizedBasePath)) {
      prefix = path.posix.join(prefix, routeName);
    }

    /**
     * Convert Flutry dynamic route parameters from
     * `$parameter` notation to Fastify's `:parameter`
     * notation.
     */
    prefix = this.convertParameters(prefix);

    /**
     * Apply the globally configured API prefix.
     */
    return this.applyGlobalPrefix(prefix);
  }

  /**
   * Converts Flutry dynamic route parameters into
   * Fastify-compatible parameters.
   *
   * Example:
   *
   * `/users/$id`
   * → `/users/:id`
   *
   * @param route Route path.
   * @returns Route path with converted parameters.
   */
  private convertParameters(route: string): string {
    return route
      .split('/')
      .map((segment) => (segment.startsWith('$') ? `:${segment.slice(1)}` : segment))
      .join('/');
  }

  /**
   * Applies the global API prefix to a route.
   *
   * Both the configured prefix and route are normalized
   * to prevent duplicate slashes.
   *
   * Examples:
   *
   * prefix `/api` + route `/users`
   * → `/api/users`
   *
   * prefix `/api` + route `/`
   * → `/api`
   *
   * @param route Route path.
   * @returns Route path including the global prefix.
   */
  private applyGlobalPrefix(route: string): string {
    const prefix = this.options.prefix;

    /**
     * No global prefix is configured.
     */
    if (!prefix) {
      return route || '/';
    }

    /**
     * Remove leading and trailing slashes from
     * the configured global prefix.
     */
    const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, '');

    /**
     * Remove leading and trailing slashes from
     * the route path.
     */
    const normalizedRoute = route.replace(/^\/+|\/+$/g, '');

    /**
     * Global prefix is empty.
     */
    if (!normalizedPrefix) {
      return normalizedRoute ? `/${normalizedRoute}` : '/';
    }

    /**
     * Route itself is empty.
     */
    if (!normalizedRoute) {
      return `/${normalizedPrefix}`;
    }

    /**
     * Combine the global prefix and route path.
     */
    return `/${normalizedPrefix}/${normalizedRoute}`;
  }

  /**
   * Registers framework-level system routes and handlers.
   *
   * System handlers include:
   *
   * - `/favicon.ico` — prevents unnecessary favicon errors.
   * - `/health` — basic application health check.
   * - 404 handler — handles unknown routes.
   * - Error handler — handles unexpected Fastify errors.
   */
  private registerSystemHandlers(): void {
    /**
     * Handle browser favicon requests without returning
     * a response body.
     */
    this.app.get('/favicon.ico', async (_request, reply) => {
      return reply.code(204).send();
    });

    /**
     * Basic health-check endpoint.
     *
     * Can be used by load balancers, monitoring systems,
     * or deployment infrastructure.
     */
    this.app.get('/health', async (_request, reply) => {
      return reply.code(200).send({
        status: 200,
        message: 'Pong',
      });
    });

    /**
     * Handle requests that do not match any registered route.
     */
    this.app.setNotFoundHandler(async (_request, reply) => {
      return reply.code(404).send({
        status: 404,
        message: 'Not Found',
      });
    });

    /**
     * Global Fastify error handler.
     *
     * Errors are logged through the Flutry logger and
     * converted into a consistent JSON response.
     */
    this.app.setErrorHandler((error: FastifyError, _request, reply) => {
      /**
       * Log the original error for debugging and
       * server-side diagnostics.
       */
      logger.error(error as any);

      /**
       * Use the error's status code when it represents
       * a client/server HTTP error. Otherwise default
       * to 500 Internal Server Error.
       */
      const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;

      /**
       * Do not expose internal error details for
       * server-side errors.
       */
      return reply.code(statusCode).send({
        status: statusCode,
        message: statusCode >= 500 ? 'Internal Server Error' : error.message,
      });
    });
  }
}
