import { FastifyPluginAsync } from 'fastify';

import { CtxHandler, HttpMethod, RouteDefinition } from '../types/router.types';

import { Ctx } from './context';

/**
 * Base router class for defining Flutry HTTP routes.
 *
 * Router provides a simple abstraction over Fastify's route
 * registration system.
 *
 * Routes can be defined using the protected HTTP method helpers:
 *
 * - get()
 * - post()
 * - put()
 * - delete()
 * - patch()
 * - head()
 * - options()
 *
 * Example:
 *
 * ```ts
 * export default class UserRouter extends Router {
 *   constructor() {
 *     super();
 *
 *     this.get('/', async (ctx) => {
 *       return ctx.send({
 *         message: 'Hello World',
 *       });
 *     });
 *   }
 * }
 * ```
 *
 * The RouteLoader is responsible for calling plugin() and
 * registering the generated Fastify plugin.
 */
export abstract class Router {
  /**
   * Collection of routes registered by the router.
   *
   * Routes are stored during construction and registered
   * with Fastify when plugin() is executed.
   */
  private readonly routes: RouteDefinition[] = [];

  /**
   * Registers a GET route.
   *
   * @param path Route path relative to the router prefix.
   * @param handler Route request handler.
   */
  protected get(path: string, handler: CtxHandler): void {
    this.add('get', path, handler);
  }

  /**
   * Registers a POST route.
   *
   * @param path Route path relative to the router prefix.
   * @param handler Route request handler.
   */
  protected post(path: string, handler: CtxHandler): void {
    this.add('post', path, handler);
  }

  /**
   * Registers a PUT route.
   *
   * @param path Route path relative to the router prefix.
   * @param handler Route request handler.
   */
  protected put(path: string, handler: CtxHandler): void {
    this.add('put', path, handler);
  }

  /**
   * Registers a DELETE route.
   *
   * @param path Route path relative to the router prefix.
   * @param handler Route request handler.
   */
  protected delete(path: string, handler: CtxHandler): void {
    this.add('delete', path, handler);
  }

  /**
   * Registers a PATCH route.
   *
   * @param path Route path relative to the router prefix.
   * @param handler Route request handler.
   */
  protected patch(path: string, handler: CtxHandler): void {
    this.add('patch', path, handler);
  }

  /**
   * Registers a HEAD route.
   *
   * @param path Route path relative to the router prefix.
   * @param handler Route request handler.
   */
  protected head(path: string, handler: CtxHandler): void {
    this.add('head', path, handler);
  }

  /**
   * Registers an OPTIONS route.
   *
   * @param path Route path relative to the router prefix.
   * @param handler Route request handler.
   */
  protected options(path: string, handler: CtxHandler): void {
    this.add('options', path, handler);
  }

  /**
   * Adds a route definition to the router.
   *
   * The route is not immediately registered with Fastify.
   * It is stored internally and registered later when
   * plugin() is executed.
   *
   * @param method HTTP method.
   * @param path Route path.
   * @param handler Route request handler.
   */
  private add(method: HttpMethod, path: string, handler: CtxHandler): void {
    this.routes.push({
      method,
      path,
      handler,
    });
  }

  /**
   * Creates a Fastify plugin containing all registered routes.
   *
   * RouteLoader uses this plugin to register the router
   * under the resolved route prefix.
   *
   * Each route handler receives a Flutry Ctx instance
   * instead of the raw Fastify request and reply objects.
   *
   * @returns Fastify plugin containing the router's routes.
   */
  public plugin(): FastifyPluginAsync {
    /**
     * Capture the registered routes so the generated plugin
     * can register them when Fastify executes it.
     */
    const routes = this.routes;

    return async (app): Promise<void> => {
      /**
       * Register every route definition with Fastify.
       */
      for (let i = 0; i < routes.length; i++) {
        const route = routes[i];

        app[route.method](route.path, async (request, reply) => {
          /**
           * Wrap the native Fastify request and reply
           * objects in the Flutry request context.
           */
          const ctx = new Ctx(request, reply);

          /**
           * Execute the user-defined route handler.
           */
          return route.handler(ctx);
        });
      }
    };
  }
}
