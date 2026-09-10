import Redis from 'ioredis';
import crypto from 'crypto';
import { config } from '../config';

let redis: Redis;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      lazyConnect: true,
    });
  }
  return redis;
}

// Compute cache key: SHA256(sql + tenantId)
export function cacheKey(sql: string, tenantId: string): string {
  return crypto.createHash('sha256').update(sql + tenantId).digest('hex');
}

// Determine TTL: 30s for last hour of data, 5min for historical
export function ttlSeconds(isRecent: boolean): number {
  return isRecent ? config.cache.ttlRecentS : config.cache.ttlHistoricalS;
}

// Lazy import of incr to avoid circular dependency (index → cache → index).
// We use a dynamic require at call-time so the module is already initialised.
function safeIncr(counter: 'cache_hits_total' | 'cache_misses_total') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { incr } = require('../index') as { incr: (c: string, by?: number) => void };
    incr(counter);
  } catch {
    // Silently ignore if module not yet initialised (e.g. during tests)
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  const r = getRedisClient();
  const val = await r.get(key);
  if (!val) {
    safeIncr('cache_misses_total');
    return null;
  }
  safeIncr('cache_hits_total');
  return JSON.parse(val) as T;
}

export async function setCached(key: string, value: unknown, ttl: number): Promise<void> {
  const r = getRedisClient();
  await r.setex(key, ttl, JSON.stringify(value));
}
