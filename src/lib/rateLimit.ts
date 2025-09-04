type Window = {
  count: number;
  resetAt: number; // epoch ms
};

const buckets = new Map<string, Window>();

function nowMs() {
  return Date.now();
}

/**
 * Simple in-memory fixed-window rate limiter.
 * Not distributed; adequate for single-instance deployments.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const t = nowMs();
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

export function rlKeyFromRequest(req: Request, scope: string): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  return `${scope}:${ip}`;
}
