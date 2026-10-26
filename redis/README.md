<div align="center">

<img src="./assets/logo.png" alt="Flutry Redis" width="180" />

# @flutry/redis

**Redis integration for the Flutry ecosystem.**

A lightweight, TypeScript-first Redis service built on top of
ioredis for Node.js applications.

[![npm version](https://img.shields.io/npm/v/@flutry/redis.svg)](https://www.npmjs.com/package/@flutry/redis)
[![license](https://img.shields.io/npm/l/@flutry/redis.svg?cacheSeconds=1)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6.svg)](https://www.typescriptlang.org/)

</div>

---

## About

`@flutry/redis` provides a simple Redis integration for the Flutry
ecosystem.

The package uses `ioredis` internally and provides a consistent
API for storing, retrieving, and deleting JSON data.

It also supports connection management, automatic reconnecting,
connection status tracking, key prefixes, and error handling.

The goal is simple:

> Provide a simple and reliable Redis service for Flutry applications.

### Features

- 🔴 Redis integration powered by ioredis
- 🔌 Explicit connection management
- 🔄 Automatic reconnect support through ioredis
- 📦 JSON value serialization
- ⏱️ Optional key expiration
- 🏷️ Configurable key prefix
- 📊 Connection status tracking
- 🛡️ Connection state validation
- ⏳ Bounded connection and operation timeouts
- 📘 TypeScript-first API
- ⚡ Shared Redis service instance

---

## Installation

```bash
npm install @flutry/redis
```

A running Redis server is required.

---

## Quick Start

Import the shared Redis service:

```ts
import { redis } from '@flutry/redis';
```

Connect before performing operations:

```ts
await redis.connect();

await redis.set('user:1', {
  id: 1,
  username: 'HEDI',
});

const user = await redis.get('user:1');

console.log(user);
```

The package exports a shared `redis` instance.

You do not need to create a new Redis service instance.

---

## Redis Configuration

The Redis connection is configured using environment variables.

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_PREFIX=
```

### Configuration Options

| Variable         | Default     | Description                   |
| ---------------- | ----------- | ----------------------------- |
| `REDIS_HOST`     | `localhost` | Redis server hostname         |
| `REDIS_PORT`     | `6379`      | Redis server port             |
| `REDIS_PASSWORD` | Empty       | Redis authentication password |
| `REDIS_PREFIX`   | Empty       | Prefix added to Redis keys    |

Configure these variables before establishing the Redis connection.

---

## Connecting to Redis

The shared service provides a connection method:

```ts
import { redis } from '@flutry/redis';

await redis.connect();
```

Applications should establish the connection during startup
before performing Redis operations.

The service uses ioredis internally to manage the connection.

Depending on the configured connection strategy, ioredis can
attempt to reconnect after a connection is lost.

---

## Getting Data

Use `get()` to retrieve a value from Redis.

```ts
const user = await redis.get('user:1');
```

Stored JSON values are automatically parsed.

Example:

```ts
await redis.set('user:1', {
  id: 1,
  username: 'HEDI',
});

const user = await redis.get('user:1');

console.log(user);
```

Result:

```ts
{
  id: 1,
  username: 'HEDI',
}
```

If the key does not exist, `get()` returns `null`.

```ts
const value = await redis.get('unknown');

console.log(value); // null
```

---

## Setting Data

Use `set()` to store a value in Redis.

```ts
await redis.set('user:1', {
  id: 1,
  username: 'HEDI',
});
```

Values are serialized as JSON before storage.

On success, the method returns:

```text
OK
```

---

## Expiration

An optional TTL can be specified in seconds.

```ts
await redis.set(
  'session:123',
  {
    userId: 1,
  },
  3600,
);
```

The key expires after one hour.

Another example:

```ts
await redis.set(
  'verification:abc',
  {
    userId: 123,
  },
  900,
);
```

This key expires after 15 minutes.

---

## Deleting Data

Use `delete()` to remove a key.

```ts
const deleted = await redis.delete('user:1');
```

The method returns the number of deleted keys.

If the key existed:

```text
1
```

If the key did not exist:

```text
0
```

---

## Key Prefix

A global Redis key prefix can be configured using:

```env
REDIS_PREFIX=flutry:
```

For example:

```ts
await redis.set('user:1', {
  id: 1,
});
```

The resulting Redis key is:

```text
flutry:user:1
```

The prefix is automatically applied to supported operations.

---

## Connection Management

The package exports a shared Redis service instance:

```ts
import { redis } from '@flutry/redis';
```

Connect during application startup:

```ts
await redis.connect();
```

Close the connection during application shutdown:

```ts
await redis.quit();
```

The service is designed to handle connection state,
connection errors, and reconnect behavior through ioredis.

### Graceful Shutdown

A basic application lifecycle example:

```ts
import { redis } from '@flutry/redis';

async function main() {
  await redis.connect();

  await redis.set('status', {
    online: true,
  });
}

async function shutdown() {
  await redis.quit();
}

process.once('SIGINT', () => {
  void shutdown();
});

process.once('SIGTERM', () => {
  void shutdown();
});

void main();
```

For production applications, integrate Redis shutdown into
the application's existing graceful shutdown workflow.

---

## Timeouts

The Redis service uses bounded waiting for connection
establishment, Redis operations, and graceful shutdown.

This helps prevent an application from waiting indefinitely
when Redis is unavailable or unresponsive.

A timeout or connection failure can reject an operation.

Applications should handle these failures according to their
own requirements.

---

## Error Handling

Redis operation failures are logged through the Flutry
logger and propagated to the caller.

Example:

```ts
try {
  const user = await redis.get('user:1');

  console.log(user);
} catch (error) {
  console.error('Redis operation failed:', error);
}
```

Applications should not assume Redis is always available.

For operations that depend on Redis, consider implementing
appropriate fallback or retry behavior at the application level.

---

## Shared Instance

The package provides a shared `redis` instance.

```ts
import { redis } from '@flutry/redis';

await redis.connect();

await redis.set('test', {
  message: 'Hello Redis',
});

const value = await redis.get('test');

console.log(value);
```

The public `redis` export is an instance, not a constructor.

Do not use:

```ts
const client = new redis();
```

The shared instance is intended to be reused throughout
the application.

---

## Atomic Rate Limit Counters

```ts
import { redis } from '@flutry/redis';

const result = await redis.consumeRateLimit('my-app:rate-limit:rule:client-hash', 100, 60000);
// { allowed: boolean, count: number, ttlMilliseconds: number }
```

The quota and window in milliseconds must be positive safe integers. A single
Lua script decides admission and updates the counter atomically. New counters
receive expiration in their initial SET; existing missing expirations are repaired
before incrementing. Denied requests do not extend the window. REDIS_PREFIX is
applied once, just as for other service methods.

Keep these numeric counter keys separate from JSON cache keys. Errors propagate;
an interrupted write might already have executed. Use the server's RateLimit for
HTTP integration, hashed identifiers, independent rule names, and deadlines.

Run unit tests with `npm test`. To run the live concurrency, expiration, and TTL
repair checks, explicitly set `FLUTRY_REDIS_INTEGRATION=1`, configure REDIS_HOST,
REDIS_PORT, optional REDIS_PASSWORD, and a test-only REDIS_PREFIX, then run
`npm test` against a disposable test Redis. Live checks are skipped by default
and remove only their randomly named counter keys.

## TypeScript

`@flutry/redis` is written in TypeScript and includes
type declarations.

Example:

```ts
import { redis } from '@flutry/redis';

const value = await redis.get('user:1');
```

VS Code and other TypeScript-compatible editors provide
type information through IntelliSense.

---

## Flutry Ecosystem

`@flutry/redis` is the Redis component of the Flutry ecosystem.

It is designed to work with other Flutry packages while
providing a simple abstraction over ioredis.

```text
@flutry/common
       |
       +-- Logger

@flutry/redis
       |
       +-- Shared redis instance
       +-- Connection management
       +-- JSON operations
```

---

## Design Goals

### Simple

Common Redis operations should require minimal boilerplate.

### Lightweight

The package provides a small abstraction without hiding
Redis behind an unnecessarily complex API.

### Reliable

Connection failures, reconnecting, and timeouts are handled
through the service and its underlying Redis client.

### Type-safe

The public API is written for TypeScript and includes
declaration files.

### Consistent

The package follows conventions used throughout the
Flutry ecosystem.

---

## License

Apache License 2.0

See the [LICENSE](LICENSE) file for the complete license text.

---

<div align="center">

**Flutry Redis**

Part of the Flutry ecosystem.

</div>
