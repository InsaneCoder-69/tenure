import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ── route registry ────────────────────────────────────────────────────────────

export type RateLimitRoute = 'review' | 'feedback' | 'memory';

// Per-route daily request caps (sliding 24-hour window, shared across all IPs).
// These are global limits for the demo, not per-IP limits.
const DAILY_LIMITS: Record<RateLimitRoute, number> = {
  review:   100,
  feedback: 300,
  memory:    30,
};

// ── lazy singleton ────────────────────────────────────────────────────────────
// Redis and Ratelimit instances are created on first use, not at module load.
// This prevents import-time crashes when UPSTASH_* env vars are absent — which
// would otherwise break the REPLAY fixture fallback in /api/review.

let _redis: Redis | null = null;
let _redisChecked = false;
const _limiters = new Map<RateLimitRoute, Ratelimit>();

function lazyRedis(): Redis | null {
  if (_redisChecked) return _redis;
  _redisChecked = true;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

function lazyLimiter(route: RateLimitRoute): Ratelimit | null {
  if (_limiters.has(route)) return _limiters.get(route)!;
  const r = lazyRedis();
  if (!r) return null;
  const lim = new Ratelimit({
    redis:     r,
    limiter:   Ratelimit.slidingWindow(DAILY_LIMITS[route], '1 d'),
    analytics: false,
    prefix:    'tenure:rl',
  });
  _limiters.set(route, lim);
  return lim;
}

// ── public API ────────────────────────────────────────────────────────────────

/** True only when both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set. */
export function isUpstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Returns the lazy Redis instance, or null when Upstash is not configured.
 * Used by API routes for caching so they share the same connection pool and
 * avoid constructing a second Redis instance.
 */
export function getRedis(): Redis | null {
  return lazyRedis();
}

export interface RateLimitResult {
  /** Whether the request is permitted. */
  allowed: boolean;
  /** Unix ms timestamp when the window resets (0 when unconfigured). */
  reset: number;
  /** False when UPSTASH_* env vars are absent — caller should return 503. */
  configured: boolean;
}

/**
 * Check the per-route daily rate limit for an identifier (IP or user key).
 *
 * - Unconfigured (no env vars): returns { configured: false } — caller returns 503.
 * - Rate limited:               returns { allowed: false }    — caller returns 429.
 * - Redis error:                fails open ({ allowed: true }) so infra issues
 *   never hard-block legitimate users.
 */
export async function checkRateLimit(
  identifier: string,
  route: RateLimitRoute,
): Promise<RateLimitResult> {
  const lim = lazyLimiter(route);

  if (!lim) {
    return { allowed: false, reset: 0, configured: false };
  }

  try {
    const { success, reset } = await lim.limit(`${route}:${identifier}`);
    return { allowed: success, reset, configured: true };
  } catch {
    // Redis unreachable — fail open rather than blocking users over infra issues.
    return { allowed: true, reset: 0, configured: true };
  }
}
