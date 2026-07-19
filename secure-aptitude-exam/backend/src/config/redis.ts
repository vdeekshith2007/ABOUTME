import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => {
    if (times > 3) return null;
    return Math.min(times * 200, 1000);
  },
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err));

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function setCache(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const serialized = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, serialized);
  } else {
    await redis.set(key, serialized);
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  if (!data) return null;
  return JSON.parse(data) as T;
}

export async function deleteCache(key: string): Promise<void> {
  await redis.del(key);
}

export async function deletePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) await redis.del(...keys);
}
