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

The package uses `ioredis` internally and provides a small, consistent
API for storing, retrieving, and deleting JSON data from Redis.

The service also handles connection management, automatic reconnecting,
connection status tracking, key prefixes, and error handling.

The goal is simple:

> Provide a simple and reliable Redis service for Flutry applications.

### Features

- 🔴 Redis integration powered by ioredis
- 🔌 Automatic connection management
- 🔄 Automatic reconnect support
- 📦 JSON value serialization
- ⏱️ Optional key expiration
- 🏷️ Configurable key prefix
- 📊 Connection status information
- 🛡️ Connection state validation
- 📘 TypeScript-first API
- ⚡ Ready-to-use Redis instance

---

## Installation

```bash
npm install @flutry/redis
```

---

# Usage

The package provides a ready-to-use `redisService` instance.

```ts
import { redisService } from '@flutry/redis';
```

You can immediately use the service:

```ts
await redisService.set('user:1', {
  id: 1,
  username: 'HEDI',
});

const user = await redisService.get('user:1');

console.log(user);
```

---

# Redis Configuration

The Redis connection is configured using environment variables.

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_PREFIX=
```

### Configuration options

| Variable         | Default     | Description                     |
| ---------------- | ----------- | ------------------------------- |
| `REDIS_HOST`     | `localhost` | Redis server hostname           |
| `REDIS_PORT`     | `6379`      | Redis server port               |
| `REDIS_PASSWORD` | -           | Redis authentication password   |
| `REDIS_PREFIX`   | -           | Prefix added to every Redis key |

---

# Getting Data

Use `get()` to retrieve a value from Redis.

```ts
const user = await redisService.get('user:1');
```

Values are automatically parsed from JSON.

For example:

```ts
await redisService.set('user:1', {
  id: 1,
  username: 'HEDI',
});

const user = await redisService.get('user:1');

console.log(user);
```

The result is:

```ts
{
  id: 1,
  username: 'HEDI',
}
```

If the key does not exist:

```ts
const value = await redisService.get('unknown');

console.log(value);
```

Returns:

```text
null
```

---

# Setting Data

Use `set()` to store data in Redis.

```ts
await redisService.set('user:1', {
  id: 1,
  username: 'HEDI',
});
```

Values are automatically serialized using `JSON.stringify()`.

The method returns:

```text
OK
```

---

# Expiration

An optional TTL can be specified in seconds.

```ts
await redisService.set(
  'session:123',
  {
    userId: 1,
  },
  3600,
);
```

The key will automatically expire after one hour.

Example:

```ts
await redisService.set(
  'verification:abc',
  {
    userId: 123,
  },
  900,
);
```

This creates a key that expires after 15 minutes.

---

# Deleting Data

Use `delete()` to remove a key.

```ts
const deleted = await redisService.delete('user:1');
```

The method returns the number of deleted keys.

```text
1
```

If the key does not exist:

```text
0
```

---

# Key Prefix

A global Redis key prefix can be configured using:

```env
REDIS_PREFIX=flutry:
```

When using:

```ts
await redisService.set('user:1', {
  id: 1,
});
```

The actual Redis key becomes:

```text
flutry:user:1
```

The prefix is automatically applied to all supported operations.

---

# Connection Management

The Redis service automatically establishes a connection when the
service instance is created.

```ts
import { redisService } from '@flutry/redis';
```

The service automatically handles:

- Initial connection
- Connection errors
- Connection closing
- Reconnecting
- Connection state tracking

---

---

# RedisService

If you need to create your own Redis service instance, the
`RedisService` class is also exported.

```ts
import { RedisService } from '@flutry/redis';

const redis = new RedisService();
```

You can then use the same API:

```ts
await redis.set('test', {
  message: 'Hello Redis',
});

const value = await redis.get('test');
```

For most applications, the built-in instance is recommended:

# Error Handling

Redis operation errors are logged through the Flutry logger and then
re-thrown to the caller.

Example:

```ts
try {
  await redisService.get('user:1');
} catch (error) {
  console.error(error);
}
```

Operations also verify that Redis is connected before executing.

If Redis is unavailable, the service throws:

```text
Redis is not connected
```

---

# TypeScript

`@flutry/redis` is written entirely in TypeScript and includes
declaration files.

Type information is automatically available:

```ts
import { redisService } from '@flutry/redis';

const value = await redisService.get('user:1');
```

VS Code and other TypeScript-compatible editors automatically provide
type information through IntelliSense.

---

# Flutry Ecosystem

`@flutry/redis` is the Redis component of the Flutry ecosystem.

It is designed to work together with other Flutry packages while
providing a simple abstraction over `ioredis`.

```text
@flutry/common
       │
       └── Logger

@flutry/redis
       │
       └──  redisService
```

---

# Design Goals

### Simple

Common Redis operations should require minimal boilerplate.

### Lightweight

The package provides a small abstraction without hiding Redis behind
an unnecessarily complex API.

### Reliable

Connection failures and reconnecting are handled automatically.

### Type-safe

The public API is written for TypeScript and includes declaration files.

### Consistent

The package follows the conventions used throughout the Flutry
ecosystem.

---

# License

Apache License 2.0

See the [LICENSE](LICENSE) file for the complete license text.

---

<div align="center">

**Flutry Redis**

Part of the Flutry ecosystem.

</div>
