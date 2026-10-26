export interface RedisRateLimitResult {
  allowed: boolean;
  count: number;
  ttlMilliseconds: number;
}

/**
 * One atomic, client-anchored fixed window. New keys receive their TTL in SET
 * itself, before any later command could fail. Existing counters without a TTL
 * are repaired before incrementing. Denied requests never extend the window.
 */
export const RATE_LIMIT_SCRIPT = `
local current = redis.call('GET', KEYS[1])
local window = tonumber(ARGV[1])
local max = tonumber(ARGV[2])

if not current then
  redis.call('SET', KEYS[1], '1', 'PX', ARGV[1])
  return {1, 1, window}
end

local count = tonumber(current)
if not count or count < 0 or count ~= math.floor(count) then
  return redis.error_reply('Invalid rate limit counter')
end

local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = window
end

if count >= max then
  return {0, count, ttl}
end

count = redis.call('INCR', KEYS[1])
return {1, count, ttl}
`;
