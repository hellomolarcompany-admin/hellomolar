import Redis from 'ioredis';

type Window = { count: number; resetAt: number };
const buckets = new Map<string, Window>();

const redisUrl = process.env.REDIS_URL || '';
const redis = redisUrl ? new Redis(redisUrl) : null;

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  if (redis) {
    const now = Date.now();
    const ttlSec = Math.ceil(windowMs / 1000);
    const pipe = redis.multi();
    pipe.incr(key);
    pipe.ttl(key);
    const [incrRes, ttlRes] = (await pipe.exec()) as [unknown, unknown];
    const count = Number((incrRes as [null, number])[1] || 0);
    let ttl = Number((ttlRes as [null, number])[1] || -1);
    if (ttl < 0) {
      await redis.expire(key, ttlSec);
      ttl = ttlSec;
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: now + ttl * 1000,
    };
  }
  const t = Date.now();
  const w = buckets.get(key);
  if (!w || t >= w.resetAt) {
    const next: Window = { count: 1, resetAt: t + windowMs };
    buckets.set(key, next);
    return { allowed: true, remaining: limit - 1, resetAt: next.resetAt };
  }
  if (w.count < limit) {
    w.count++;
    return { allowed: true, remaining: limit - w.count, resetAt: w.resetAt };
  }
  return { allowed: false, remaining: 0, resetAt: w.resetAt };
}

export function rlKeyFromRequest(req: Request, scope: string, tenantId?: string): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const tid = tenantId || 'global';
  return `${scope}:${tid}:${ip}`;
}
