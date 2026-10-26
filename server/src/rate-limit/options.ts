import type { RateLimitOptions } from './types';

export function normalizeRateLimitOptions(options: RateLimitOptions) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('RateLimit options must be an object');
  }

  const max = options.max === undefined ? 100 : options.max;
  const window = options.window === undefined ? 60 : options.window;
  const maxStoreSize = options.maxStoreSize === undefined ? 10000 : options.maxStoreSize;
  const redisTimeoutMs = options.redisTimeoutMs === undefined ? 5000 : options.redisTimeoutMs;

  for (const [name, value] of Object.entries({ max, window, maxStoreSize, redisTimeoutMs })) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(`RateLimit ${name} must be a positive safe integer`);
    }
  }

  if (!Number.isSafeInteger(window * 1000)) {
    throw new RangeError('RateLimit window is too large');
  }

  if (redisTimeoutMs > 2147483647) {
    throw new RangeError('RateLimit redisTimeoutMs exceeds the Node.js timer limit');
  }

  if (options.redis !== undefined && typeof options.redis !== 'boolean') {
    throw new TypeError('RateLimit redis must be a boolean');
  }

  if (options.name !== undefined && (typeof options.name !== 'string' || !options.name.trim() || Buffer.byteLength(options.name) > 128)) {
    throw new TypeError('RateLimit name must contain 1–128 UTF-8 bytes');
  }

  if (options.redis && options.name === undefined) {
    throw new TypeError('Redis RateLimit requires a stable, unique name shared by its replicas');
  }

  for (const name of ['keyGenerator', 'skip'] as const) {
    if (options[name] !== undefined && typeof options[name] !== 'function') {
      throw new TypeError(`RateLimit ${name} must be a function`);
    }
  }

  return {
    max,
    windowMilliseconds: window * 1000,
    maxStoreSize,
    redisTimeoutMs,
    redis: options.redis ?? false,
    name: options.name,
    keyGenerator: options.keyGenerator,
    skip: options.skip,
  };
}
