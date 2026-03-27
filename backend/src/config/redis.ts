import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

let redis: Redis;

if (config.redis.url && config.redis.url !== 'none') {
  redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redis.on('connect', () => {
    logger.info('Redis connected');
  });

  redis.on('error', (err) => {
    logger.error({ err }, 'Redis error');
  });
} else {
  // In-memory stub when Redis is not available
  logger.warn('Redis not configured — using in-memory stub (not for production scale)');
  const store = new Map<string, { value: string; expiry?: number }>();

  redis = {
    ping: async () => 'PONG',
    get: async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiry && Date.now() > entry.expiry) { store.delete(key); return null; }
      return entry.value;
    },
    set: async (key: string, value: string, ...args: any[]) => {
      let expiry: number | undefined;
      if (args[0] === 'EX' && args[1]) expiry = Date.now() + args[1] * 1000;
      store.set(key, { value, expiry });
      return 'OK';
    },
    del: async (...keys: string[]) => { keys.forEach(k => store.delete(k)); return keys.length; },
    disconnect: () => {},
    on: () => redis,
    status: 'ready',
  } as any;
}

export { redis };
