import { createHash } from 'node:crypto';

type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  source: 'memory' | 'redis' | 'edge';
};

interface RateLimiter {
  check(identity: string): Promise<RateLimitResult>;
}

interface CreateRateLimiterInput {
  mode: 'memory' | 'redis' | 'edge';
  windowMs: number;
  max: number;
  redisRestUrl?: string;
  redisRestToken?: string;
  failOpen: boolean;
}

type MemoryBucket = { startedAt: number; count: number };

const memoryBuckets = new Map<string, MemoryBucket>();

function normalizeRedisBaseUrl(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function cleanupMemoryBuckets(now: number, windowMs: number) {
  // Keep memory limiter bounded by evicting expired windows on each check.
  for (const [key, bucket] of memoryBuckets.entries()) {
    if (now - bucket.startedAt > windowMs) {
      memoryBuckets.delete(key);
    }
  }
}

function createMemoryLimiter(windowMs: number, max: number): RateLimiter {
  // Process-local limiter used in development and single-instance deployments.
  return {
    async check(identity: string) {
      const now = Date.now();
      const existing = memoryBuckets.get(identity);
      let count = 1;

      if (!existing || now - existing.startedAt > windowMs) {
        memoryBuckets.set(identity, { startedAt: now, count });
      } else {
        existing.count += 1;
        count = existing.count;
      }

      cleanupMemoryBuckets(now, windowMs);
      const allowed = count <= max;
      const retryAfterSeconds = Math.max(1, Math.ceil(windowMs / 1000));
      return {
        allowed,
        count,
        limit: max,
        remaining: Math.max(0, max - count),
        retryAfterSeconds,
        source: 'memory',
      };
    },
  };
}

function createEdgeLimiter(max: number): RateLimiter {
  // Placeholder mode when an upstream gateway/CDN enforces throttling.
  return {
    async check() {
      // Edge mode delegates enforcement to a gateway/CDN layer.
      return {
        allowed: true,
        count: 0,
        limit: max,
        remaining: max,
        retryAfterSeconds: 0,
        source: 'edge',
      };
    },
  };
}

function createRedisLimiter(
  windowMs: number,
  max: number,
  redisRestUrl: string,
  redisRestToken: string,
  failOpen: boolean
): RateLimiter {
  // Distributed limiter using Redis REST pipeline (`INCR` + `PEXPIRE`) per time window.
  const baseUrl = normalizeRedisBaseUrl(redisRestUrl);

  return {
    async check(identity: string) {
      const now = Date.now();
      const windowKey = Math.floor(now / windowMs);
      const redisKey = `rl:${windowKey}:${identity}`;
      const ttlMs = windowMs - (now % windowMs) + 500;

      try {
        const response = await fetch(`${baseUrl}/pipeline`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${redisRestToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            ['INCR', redisKey],
            ['PEXPIRE', redisKey, ttlMs],
          ]),
        });

        if (!response.ok) {
          throw new Error(`redis pipeline failed (${response.status})`);
        }

        const payload = (await response.json()) as Array<{ result?: unknown }>;
        const countRaw = payload?.[0]?.result;
        const count = typeof countRaw === 'number' ? countRaw : Number(countRaw ?? 0);
        if (!Number.isFinite(count) || count <= 0) {
          throw new Error('redis returned invalid counter');
        }

        const allowed = count <= max;
        const retryAfterSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
        return {
          allowed,
          count,
          limit: max,
          remaining: Math.max(0, max - count),
          retryAfterSeconds,
          source: 'redis',
        };
      } catch (error) {
        if (!failOpen) throw error;
        return {
          allowed: true,
          count: 0,
          limit: max,
          remaining: max,
          retryAfterSeconds: 0,
          source: 'redis',
        };
      }
    },
  };
}

export function createRateLimiter(input: CreateRateLimiterInput): RateLimiter {
  // Factory entrypoint that selects limiter backend from config.
  if (input.mode === 'edge') {
    return createEdgeLimiter(input.max);
  }

  if (input.mode === 'redis') {
    if (!input.redisRestUrl || !input.redisRestToken) {
      throw new Error('RATE_LIMIT_MODE=redis requires REDIS_REST_URL and REDIS_REST_TOKEN');
    }
    return createRedisLimiter(
      input.windowMs,
      input.max,
      input.redisRestUrl,
      input.redisRestToken,
      input.failOpen
    );
  }

  return createMemoryLimiter(input.windowMs, input.max);
}

function readHeader(value: string | string[] | undefined) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

function extractBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

function tokenFingerprint(token: string) {
  return createHash('sha256').update(token).digest('hex').slice(0, 24);
}

export function resolveRateLimitIdentity(
  headers: Record<string, string | string[] | undefined>,
  ip: string,
  authMode: 'mock' | 'supabase' | 'local'
) {
  // Only trust caller-provided user headers in mock mode.
  if (authMode === 'mock') {
    const devUserId = readHeader(headers['x-dev-user-id']);
    if (devUserId) return `user:${devUserId}`;
  }

  // For real auth modes, use a stable auth-token bucket when available.
  // This avoids NAT collisions between many users sharing one IP.
  const authorization = readHeader(headers.authorization);
  const bearerToken = extractBearerToken(authorization);
  if (bearerToken && authMode !== 'mock') {
    return `auth:${tokenFingerprint(bearerToken)}`;
  }

  return `ip:${ip || 'unknown'}`;
}
