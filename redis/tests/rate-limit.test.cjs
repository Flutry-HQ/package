const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const load = Module._load;
const clients = [];

class FakeRedis extends EventEmitter {
  status = 'wait';
  result = [1, 1, 60000];
  calls = [];
  constructor(options) { super(); this.options = options; clients.push(this); }
  async connect() { this.status = 'ready'; this.emit('ready'); }
  async eval(...args) { this.calls.push(args); if (this.result instanceof Error) throw this.result; return this.result; }
  async quit() { return 'OK'; }
  disconnect() { this.status = 'end'; this.emit('end'); }
}

Module._load = function (name, ...args) {
  if (name === 'ioredis') return { Redis: FakeRedis };
  if (name === '@flutry/common') return { logger: { info() {}, warn() {}, error() {} } };
  return load.call(this, name, ...args);
};

const { redis } = require('../dist');
const { RATE_LIMIT_SCRIPT } = require('../dist/redis/rate-limit');

test('atomic counter executes one EVAL with one prefixed key and parameterized arguments', async (t) => {
  t.after(() => redis.disconnect());
  const prefix = process.env.REDIS_PREFIX;
  process.env.REDIS_PREFIX = 'test:';
  t.after(() => { if (prefix === undefined) delete process.env.REDIS_PREFIX; else process.env.REDIS_PREFIX = prefix; });
  const result = await redis.consumeRateLimit('rule:client', 5, 60000);
  assert.deepEqual(result, { allowed: true, count: 1, ttlMilliseconds: 60000 });
  assert.deepEqual(clients.at(-1).calls, [[RATE_LIMIT_SCRIPT, 1, 'test:rule:client', 60000, 5]]);
  assert.equal(clients.at(-1).options.enableOfflineQueue, false);
  assert.equal(clients.at(-1).options.commandTimeout, 5000);
});

test('denied counter and millisecond TTL are returned without JSON conversion', async (t) => {
  t.after(() => redis.disconnect());
  await redis.connect();
  clients.at(-1).result = [0, 5, 1234];
  assert.deepEqual(await redis.consumeRateLimit('counter', 5, 60000), { allowed: false, count: 5, ttlMilliseconds: 1234 });
});

test('invalid counters are rejected rather than allowing a request', async (t) => {
  t.after(() => redis.disconnect());
  await redis.connect();
  for (const result of [null, [], [1, 1], [2, 1, 100], [1, 0, 100], [1, '1', 100], [1, 1, -1], [1, Number.MAX_SAFE_INTEGER + 1, 100]]) {
    clients.at(-1).result = result;
    await assert.rejects(redis.consumeRateLimit('counter', 5, 60000), /Invalid Redis rate limit response/);
  }
});

test('invalid options fail before Redis initialization and EVAL errors propagate', async (t) => {
  t.after(() => redis.disconnect());
  for (const [key, max, window] of [['', 1, 100], ['x'.repeat(1025), 1, 100], ['x', 0, 100], ['x', 1.1, 100], ['x', 1, 0], ['x', 1, Infinity]]) {
    await assert.rejects(redis.consumeRateLimit(key, max, window));
  }
  assert.equal(redis.getConnectionStatus().status, 'not_initialized');
  await redis.connect();
  clients.at(-1).result = new Error('EVAL unavailable');
  await assert.rejects(redis.consumeRateLimit('counter', 5, 60000), /EVAL unavailable/);
  assert.equal(clients.at(-1).calls.length, 1);
});
