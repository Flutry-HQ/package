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
}

let connection: SharedConnection | undefined;
let closing: Promise<void> | undefined;

function loadClient(): RedisClient {
  // Keep Redis optional at both compile time and runtime. Memory mode never calls this.
  const loaded: unknown = require('@flutry/redis');

  if (!loaded || typeof loaded !== 'object' || !('redis' in loaded)) {
    throw new Error('@flutry/redis does not export its redis singleton');
  }

  const client = loaded.redis as Partial<RedisClient> | undefined;

  if (
    !client ||
    typeof client.connect !== 'function' ||
    typeof client.disconnect !== 'function' ||
    typeof client.getConnectionStatus !== 'function' ||
    typeof client.consumeRateLimit !== 'function'
  ) {
    throw new Error('Install a version of @flutry/redis that supports consumeRateLimit');
  }

  return client as RedisClient;
}

export async function acquireRedis(owner: symbol): Promise<RedisClient> {
  while (closing) {
    await closing;
  }

  if (!connection) {
    const client = loadClient();
    connection = { client, owners: new Set(), owned: client.getConnectionStatus().status === 'not_initialized' };
  }

  const current = connection;
  current.owners.add(owner);

  try {
    await current.client.connect();
    return current.client;
  } catch (error) {
    await releaseRedis(owner);
    throw error;
  }
}

export async function releaseRedis(owner: symbol): Promise<void> {
  const current = connection;

  if (!current || !current.owners.delete(owner) || current.owners.size > 0) {
    return;
  }

  connection = undefined;

  // Leave connections established by application code under that application's ownership.
  const operation = current.owned ? current.client.disconnect() : Promise.resolve();
  closing = operation;

  try {
    await operation;
  } finally {
    if (closing === operation) closing = undefined;
  }
}
