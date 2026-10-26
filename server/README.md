<div align="center">

<img src="./assets/logo.png" alt="Flutry Server" width="180" />

# @flutry/server

**Fastify-based server for the Flutry ecosystem.**

A lightweight, structured HTTP server package built on top of Fastify
for Node.js and TypeScript applications.

[![npm version](https://img.shields.io/npm/v/@flutry/server.svg)](https://www.npmjs.com/package/@flutry/server)
[![license](https://img.shields.io/npm/l/@flutry/server.svg?cacheSeconds=1)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6.svg)](https://www.typescriptlang.org/)

</div>

---

## About the package

`@flutry/server` is the server layer of the Flutry ecosystem.

It provides a structured and reusable HTTP server implementation built on
top of Fastify, while exposing a Flutry-oriented API instead of requiring
applications to work directly with the underlying server implementation.

The package also includes the Flutry Router integration, providing
automatic route loading, request context handling, and route registration.

The goal is simple:

> Provide a fast, reliable, and structured server foundation for Flutry applications.

The package currently provides:

- 🌐 Fast HTTP server powered by Fastify
- 🛡️ Security-focused server configuration
- 📦 Compression support
- 🔌 Fastify plugin support
- 🧭 Integrated Flutry Router
- 📂 Automatic route loading
- 🧩 Request context handling
- 📘 TypeScript-first API
- ⚡ Simple server initialization
- 🔧 Configurable server options

---

## Installation

```bash
npm install @flutry/server
```

## Rate limiting

`RateLimit` uses a client-anchored fixed window: the first admitted request starts
the window, and blocked requests do not extend it. `max` is the maximum admitted
requests; `window` is a positive integer number of seconds.

### Global HTTP limits

```ts
import { HttpServer } from '@flutry/server';

const server = new HttpServer({
  trustProxy: false,
  socket: false,
  rateLimit: {
    enabled: true,
    max: 100,
    window: 60,
    redis: false,
    exclude: ['/health', '/favicon.ico'],
  },
});

void server.listen(1337).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Omit `rateLimit`, set it to `false`, or use `{ enabled: false }` to disable global
limiting. Supplied numeric options are validated even when disabled. Memory mode
needs no Redis package, configuration, or connection.

Global limiting runs at Fastify's `onRequest` stage, before body parsing. Exact
paths `/health` and `/favicon.ico` are excluded by default, ignoring queries.
Override `exclude`, or set `exclude: []` to include them. The configured Socket.IO
transport path is excluded when Socket.IO is enabled. This feature does not limit
Socket.IO event messages or change its connection handling.

### Route-specific limits and identities

Create one reusable rule outside the request handler:

```ts
import { RateLimit, Router } from '@flutry/server';

const loginLimit = new RateLimit({ max: 5, window: 60, redis: false });

export default class LoginRoute extends Router {
  constructor() {
    super();
    this.post('/', async (ctx) => {
      await loginLimit.handle(ctx);
      return ctx.send({ message: 'Continue authentication here' });
    });
  }
}
```

`handle()` resolves with `{ allowed: true, limit, remaining, reset }` when admitted.
It throws `RateLimitExceededError` (`statusCode: 429`) when blocked, stopping code
after the awaited check. Always await it and do not catch and ignore the rejection.
Flutry's existing error handler produces the response. Backend, capacity, and
identifier failures throw `RateLimitUnavailableError` (`statusCode: 503`) with a
safe public message.

The default client identity is `ctx.req.ip`, determined by Fastify's `trustProxy`
configuration. Forwarding headers are never trusted manually. Configure trusted
proxies according to your deployment.

Custom `keyGenerator` and `skip` callbacks may be synchronous or asynchronous:

```ts
import { RateLimit } from '@flutry/server';

const limit = new RateLimit({
  max: 10,
  window: 60,
  keyGenerator: async (ctx) => ctx.req.ip,
  skip: (ctx) => ctx.req.method === 'OPTIONS',
});
```

To use authenticated user IDs, run a route-specific check after authentication
and return the ID from your trusted application context. Do not substitute an
unverified user header. Global callbacks execute before body parsing and later
authentication hooks. Keys must be nonblank strings of at most 4,096 UTF-8 bytes.
A `skip` exemption consumes no quota and sets no headers.

Global and route rules are independent. Each request consumes at most one slot in
each rule it reaches; repeated or concurrent checks of the same rule and request
do not count again. A local rejection still counts toward a global rule that
already admitted the request. The last evaluated rule supplies the response quota
headers. Reusing one rule across routes shares its quota across those routes.

### Optional Redis storage

Install the updated companion package only where Redis is needed:

```bash
npm install @flutry/redis
```

It must include `redis.consumeRateLimit()`; older builds fail closed rather than
using a non-atomic counter.

```ts
import { HttpServer, RateLimit } from '@flutry/server';

const server = new HttpServer({
  socket: false,
  rateLimit: {
    enabled: true,
    redis: true,
    name: 'my-app:global',
    max: 100,
    window: 60,
  },
});

const loginLimit = new RateLimit({
  redis: true,
  name: 'my-app:auth:login',
  max: 5,
  window: 60,
});

// Register lifecycle hooks for route-specific Redis rules.
server.app.addHook('onReady', async () => { await loginLimit.connect(); });
server.app.addHook('onClose', async () => { await loginLimit.close(); });
```

Every Redis rule requires a stable name of 1–128 UTF-8 bytes. Use unique names for
different rules and identical names, limits, key generators, and Redis settings
on replicas enforcing one rule. The global rule receives the default name
`global`; choose an application-specific name when sharing Redis.

The existing singleton supplies connections using `REDIS_HOST`, `REDIS_PORT`,
`REDIS_PASSWORD`, and `REDIS_PREFIX`. Counters use a dedicated
`flutry:rate-limit:v1:` namespace after the configured prefix. Rule names and
client identifiers are SHA-256 hashed in keys; predictable identifiers are not
made anonymous by hashing.

A single Lua operation decides admission, increments the counter, and establishes
or repairs expiration. Counters saturate at the quota; blocked requests do not
extend the window. Global readiness waits for Redis before HTTP begins listening.
Route rules connect lazily unless their readiness hook is registered as above.

Unavailable Redis and timeouts return 503, never a memory fallback. An interrupted
operation might already have consumed quota, so the limiter does not explicitly
retry an increment.

`close()` is idempotent and releases a rule's resources without deleting shared
counters. The last closed rule disconnects Redis if limiting established the
connection. A connection already established by application code remains under
application ownership. Close every route-specific Redis rule at shutdown; global
hooks are registered automatically.

### Options and headers

| Option | Default | Meaning |
| --- | --- | --- |
| `max` | `100` | Positive safe integer quota |
| `window` | `60` | Whole seconds, safely representable in milliseconds |
| `redis` | `false` | Enable distributed Redis storage |
| `name` | None | Stable rule name, required for Redis |
| `maxStoreSize` | `10000` | Maximum entries per memory limiter |
| `redisTimeoutMs` | `5000` | Redis operation deadline, up to Node's timer limit |
| `keyGenerator` | `ctx.req.ip` | Synchronous/asynchronous client key |
| `skip` | None | Synchronous/asynchronous explicit exemption |

Memory limits are local to one instance in one process, even when names match.
They do not aggregate across worker processes or VPS instances. A bounded map and
monotonic clock track windows. Expired entries are removed in expiration order on
subsequent operations; there are no per-client or background timers. A full store
returns 503 to new clients until space expires, preserving existing quotas.
`close()` immediately clears idle memory entries.

| Header | Meaning |
| --- | --- |
| `RateLimit-Limit` | Configured quota |
| `RateLimit-Remaining` | Remaining requests, never negative |
| `RateLimit-Reset` | Rounded-up relative seconds until reset, not a Unix timestamp |
| `Retry-After` | Same relative seconds; sent on HTTP 429 only |

The last admitted request succeeds with remaining quota zero. Further requests
receive 429 until expiration.

### Tests

Run `npm test` for Node's built-in test runner, real Fastify request tests, and
controlled Redis failure/concurrency tests. The Redis package documents its
separate opt-in live Lua integration test.
