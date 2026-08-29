import { HttpPlugin } from '@flutry/http';
import { Ctx } from '../context/context';

export type CtxHandler = (ctx: Ctx) => unknown | Promise<unknown>;

export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options';

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: CtxHandler;
}

export interface RouteLoaderOptions {
  directory: string;
  prefix?: string;
}

export type RoutePlugin = HttpPlugin;
