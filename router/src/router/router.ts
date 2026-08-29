import { CtxHandler, HttpMethod, RouteDefinition } from '../types/types';
import { Ctx } from '../context/context';
import { HttpPlugin } from '@flutry/http';

export abstract class Router {
  private readonly routes: RouteDefinition[] = [];

  protected get(path: string, handler: CtxHandler): void {
    this.add('get', path, handler);
  }

  protected post(path: string, handler: CtxHandler): void {
    this.add('post', path, handler);
  }

  protected put(path: string, handler: CtxHandler): void {
    this.add('put', path, handler);
  }

  protected delete(path: string, handler: CtxHandler): void {
    this.add('delete', path, handler);
  }

  protected patch(path: string, handler: CtxHandler): void {
    this.add('patch', path, handler);
  }

  protected head(path: string, handler: CtxHandler): void {
    this.add('head', path, handler);
  }

  protected options(path: string, handler: CtxHandler): void {
    this.add('options', path, handler);
  }

  private add(method: HttpMethod, path: string, handler: CtxHandler): void {
    this.routes.push({
      method,
      path,
      handler,
    });
  }

  public plugin(): HttpPlugin {
    const routes = this.routes;

    return async (app): Promise<void> => {
      for (let i = 0; i < routes.length; i++) {
        const route = routes[i];

        app[route.method](route.path, async (request, reply) => {
          const ctx = new Ctx(request, reply);

          return route.handler(ctx);
        });
      }
    };
  }
}
