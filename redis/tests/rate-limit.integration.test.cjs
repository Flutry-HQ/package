const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');

// Explicit opt-in: point REDIS_HOST/PORT/PASSWORD/PREFIX at a disposable test Redis.
test('live Redis: Lua across processes, expiry, persistence repair, and independent keys', { skip: process.env.FLUTRY_REDIS_INTEGRATION !== '1' }, async (t) => {
  const { redis } = require('../dist');
  const prefix = `rate-limit-integration:${randomUUID()}:`;
  const keys = ['concurrent', 'other', 'persistent', 'expiry'].map((name) => prefix + name);
  t.after(async () => {
    try { for (const key of keys) await redis.delete(key); } finally { await redis.disconnect(); }
  });
  const worker = `
    const Module = require('node:module');
    const load = Module._load;
    Module._load = function(name, ...args) {
      if (name === '@flutry/common') return { logger: { info() {}, warn() {}, error() {} } };
      return load.call(this, name, ...args);
    };
    const { redis } = require(process.argv[1]);
    (async () => {
      try {
        const replies = await Promise.all(Array.from({ length: 100 }, () => redis.consumeRateLimit(process.argv[2], 25, 60000)));
        process.stdout.write(JSON.stringify(replies));
      } finally { await redis.disconnect(); }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `;
  const workers = await Promise.all(Array.from({ length: 2 }, () => promisify(execFile)(process.execPath, ['-e', worker, path.resolve(__dirname, '../dist'), keys[0]], { timeout: 20000 })));
  const replies = workers.flatMap(({ stdout }) => JSON.parse(stdout));
  assert.equal(replies.filter((result) => result.allowed).length, 25);
  assert.ok(replies.every((result) => result.count <= 25 && result.ttlMilliseconds > 0));
  assert.equal((await redis.consumeRateLimit(keys[1], 25, 60000)).count, 1);
  await redis.set(keys[2], 2);
  assert.equal(await redis.ttl(keys[2]), -1);
  const repaired = await redis.consumeRateLimit(keys[2], 5, 60000);
  assert.equal(repaired.count, 3);
  assert.ok(await redis.ttl(keys[2]) > 0);
  const first = await redis.consumeRateLimit(keys[3], 1, 1000);
  await new Promise((resolve) => setTimeout(resolve, 40));
  const blocked = await redis.consumeRateLimit(keys[3], 1, 1000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.ttlMilliseconds < first.ttlMilliseconds);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal((await redis.consumeRateLimit(keys[3], 1, 1000)).allowed, true);
});
