import type { RateLimitCounter } from './types';

interface RedisClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionStatus(): { status: string };
  consumeRateLimit(key: string, max: number, windowMilliseconds: number): Promise<RateLimitCounter>;
}

interface SharedConnection {
  client: RedisClient;
  owners: Set<symbol>;
  owned: boolean;
  ready: Promise<void>;
}

let connection: SharedConnection | undefined;
let closing: Promise<void> | undefined;

function loadClient(): RedisClient {
  // Optional peer dependency: load only when Redis rate limiting is enabled.
  let loaded: unknown;
  try {
    loaded = require('@flutry/redis');
  } catch (error) {
    throw new Error('Redis rate limiting requires @flutry/redis to be installed');
  }

  if (!loaded || typeof loaded !== 'object' || !('redis' in loaded)) {
    throw new Error('@flutry/redis must export the redis singleton');
  }

  const client = loaded.redis as Partial<RedisClient> | undefined;
  if (!client) throw new Error('@flutry/redis exports an invalid redis singleton');

  for (const method of ['connect', 'disconnect', 'getConnectionStatus', 'consumeRateLimit'] as const) {
    if (typeof client[method] !== 'function') {
      throw new Error(`Installed @flutry/redis is incompatible: missing redis.${method}(). Update @flutry/redis and rebuild.`);
    }
  }
  return client as RedisClient;
}

export async function acquireRedis(owner: symbol): Promise<RedisClient> {
  while (closing) await closing;

  if (!connection) {
    const client = loadClient();
    const owned = client.getConnectionStatus().status === 'not_initialized';
    connection = {
      client,
      owners: new Set(),
      owned,
      ready: Promise.resolve().then(() => client.connect()),
    };
  }

  const current = connection;
  current.owners.add(owner);
  try {
    await current.ready;
    return current.client;
  } catch (error) {
    await releaseRedis(owner);
    throw error;
  }
}

export async function releaseRedis(owner: symbol): Promise<void> {
  const current = connection;
  if (!current || !current.owners.delete(owner) || current.owners.size > 0) return;

  connection = undefined;
  const operation = (async () => {
    await current.ready.catch(() => {});
    if (current.owned) await current.client.disconnect();
  })();
  closing = operation;
  try {
    await operation;
  } finally {
    if (closing === operation) closing = undefined;
  }
}
