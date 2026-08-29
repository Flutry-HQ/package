import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { logger } from '@flutry/common';
import { Router } from './router';
import { FastifyInstance, type FastifyError } from 'fastify';
import { RouteLoaderOptions } from '../types/router.types';

export class RouteLoader {
  private loaded = false;

  public constructor(
    private readonly app: FastifyInstance,
    private readonly options: RouteLoaderOptions,
  ) {}

  public async load(): Promise<void> {
    if (this.loaded) {
      return;
    }
    logger.info(`=====================================`);
    const directory = path.resolve(this.options.directory);

    await this.scan(directory, '');

    this.registerSystemHandlers();

    this.loaded = true;
  }

  private async scan(directory: string, basePath: string): Promise<void> {
    const entries = await readdir(directory, {
      withFileTypes: true,
    });

    const tasks: Promise<void>[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      const filePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        tasks.push(this.scan(filePath, path.join(basePath, entry.name)));

        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.route.ts')) {
        tasks.push(this.loadRoute(filePath, basePath, entry.name));
      }
    }

    await Promise.all(tasks);
  }

  private async loadRoute(filePath: string, routeBasePath: string, fileName: string): Promise<void> {
    const module = await import(pathToFileURL(filePath).href);

    const RouteClass = module.default;

    if (!RouteClass) {
      throw new Error(`Route "${filePath}" has no default export.`);
    }

    const route = new RouteClass();

    if (!(route instanceof Router)) {
      throw new TypeError(`Route "${filePath}" must extend Router.`);
    }

    const prefix = this.resolvePrefix(routeBasePath, fileName);

    await this.app.register(route.plugin(), {
      prefix,
    });

    if (process.env.NODE_ENV !== 'production') {
      logger.info(`Loaded route: ${prefix}`);
    }
  }

  private resolvePrefix(routeBasePath: string, fileName: string): string {
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

    const normalizedBasePath = routeBasePath.replace(/\\/g, '/');

    let prefix = path.posix.join('/', normalizedBasePath);

    /*
     * routes/users/user.route.ts
     * → /users
     *
     * routes/users/profile.route.ts
     * → /users/profile
     */
    if (routeName !== path.posix.basename(normalizedBasePath)) {
      prefix = path.posix.join(prefix, routeName);
    }

    prefix = this.convertParameters(prefix);

    return this.applyGlobalPrefix(prefix);
  }

  private convertParameters(route: string): string {
    return route
      .split('/')
      .map((segment) => (segment.startsWith('$') ? `:${segment.slice(1)}` : segment))
      .join('/');
  }

  private applyGlobalPrefix(route: string): string {
    const prefix = this.options.prefix;

    if (!prefix) {
      return route || '/';
    }

    const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, '');

    const normalizedRoute = route.replace(/^\/+|\/+$/g, '');

    if (!normalizedPrefix) {
      return normalizedRoute ? `/${normalizedRoute}` : '/';
    }

    if (!normalizedRoute) {
      return `/${normalizedPrefix}`;
    }

    return `/${normalizedPrefix}/${normalizedRoute}`;
  }

  private registerSystemHandlers(): void {
    this.app.get('/favicon.ico', async (_request, reply) => {
      return reply.code(204).send();
    });

    this.app.get('/health', async (_request, reply) => {
      return reply.code(200).send({
        status: 200,
        message: 'Pong',
      });
    });

    this.app.setNotFoundHandler(async (_request, reply) => {
      return reply.code(404).send({
        status: 404,
        message: 'Not Found',
      });
    });

    this.app.setErrorHandler((error: FastifyError, _request, reply) => {
      logger.error(error as any);

      const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;

      return reply.code(statusCode).send({
        status: statusCode,
        message: statusCode >= 500 ? 'Internal Server Error' : error.message,
      });
    });
  }
}
