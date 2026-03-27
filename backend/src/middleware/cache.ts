import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';

/**
 * Express middleware that caches JSON GET responses in Redis.
 * @param ttlSeconds  Cache TTL in seconds (default 60)
 * @param keyPrefix   Optional prefix for the cache key
 */
export function cacheResponse(ttlSeconds = 60, keyPrefix = 'api-cache') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const key = `${keyPrefix}:${req.user?.id || 'anon'}:${req.originalUrl}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }
    } catch {
      // Redis unavailable — skip cache
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      res.setHeader('X-Cache', 'MISS');
      try {
        redis.set(key, JSON.stringify(body), 'EX', ttlSeconds).catch(() => {});
      } catch {
        // ignore
      }
      return originalJson(body);
    };

    next();
  };
}
