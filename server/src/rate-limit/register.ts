import type { FastifyInstance } from 'fastify';
import { Ctx } from '../router/context';
import type { HttpOptions } from '../types/server.typet';
import { normalizeRateLimitOptions } from './options';
import { RateLimit } from './rate-limit';

export function registerRateLimit(app: FastifyInstance, options: HttpOptions): void {
  const config = options.rateLimit;
  if (config === undefined || config === false) return;

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('HttpServer rateLimit must be false or an options object');
  }

  if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
    throw new TypeError('HttpServer rateLimit.enabled must be a boolean');
  }

  const exclude = config.exclude ?? ['/health', '/favicon.ico'];

  if (!Array.isArray(exclude) || exclude.some((path) => typeof path !== 'string' || !path.startsWith('/') || path.includes('?'))) {
    throw new TypeError('HttpServer rateLimit.exclude must contain absolute URL paths without queries');
  }

  // Validate supplied numeric settings even when disabled, without acquiring Redis.
  normalizeRateLimitOptions({ ...config, name: config.name ?? 'global', redis: config.enabled === true && config.redis === true });
  if (config.redis !== undefined && typeof config.redis !== 'boolean') {
    throw new TypeError('RateLimit redis must be a boolean');
  }
  if (config.enabled !== true) return;

  const exclusions = new Set(exclude);
  const socketPath = options.socket === false ? undefined : (options.socket?.path ?? '/socket.io').replace(/\/+$/, '');
  const limiter = new RateLimit({
    ...config,
    name: config.name ?? 'global',
    skip: async (ctx) => {
      const path = (ctx.req.raw.url ?? '/').split('?')[0];

      if (exclusions.has(path) || (socketPath !== undefined && (path === socketPath || path === `${socketPath}/`))) {
        return true;
      }

      return config.skip ? await config.skip(ctx) : false;
    },
  });

  app.addHook('onReady', async () => {
    await limiter.connect();
  });

  app.addHook('onRequest', async (request, reply) => {
    await limiter.handle(new Ctx(request, reply));
  });

  app.addHook('onClose', async () => {
    await limiter.close();
  });
}
