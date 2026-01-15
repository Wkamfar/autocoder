/**
 * Redis client for caching and session storage
 */

import { Redis, RedisOptions } from "ioredis";
import { logger } from "./observability.js";

let redisClient: Redis | null = null;

/**
 * Get Redis client (singleton)
 */
export function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn("REDIS_URL not configured, Redis features disabled");
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: false,
    } as RedisOptions);

    redisClient.on("error", (error: Error) => {
      logger.error("Redis client error", { error: error.message });
    });

    redisClient.on("connect", () => {
      logger.info("Redis client connected");
    });

    redisClient.on("ready", () => {
      logger.info("Redis client ready");
    });

    return redisClient;
  } catch (error: any) {
    logger.error("Failed to create Redis client", { error: error.message });
    return null;
  }
}

/**
 * Export singleton instance
 */
export const redis = getRedisClient();
