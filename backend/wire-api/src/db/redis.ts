/**
 * Redis Connection & Utilities
 * 
 * Redis client for:
 * - Session storage
 * - Rate limiting
 * - Caching
 * - Real-time data
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

class RedisConnection {
  private client: RedisClientType | null = null;
  private config: RedisConfig;

  constructor(config: RedisConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.client?.isOpen) {
      logger.warn('Redis client already connected');
      return;
    }

    const url = `redis://${this.config.password ? `:${this.config.password}@` : ''}${this.config.host}:${this.config.port}`;
    
    this.client = createClient({
      url,
      database: this.config.db || 0,
    });

    this.client.on('error', (err) => {
      logger.error('Redis client error', { error: err });
    });

    this.client.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });

    await this.client.connect();
  }

  getClient(): RedisClientType {
    if (!this.client || !this.client.isOpen) {
      throw new Error('Redis client not connected. Call connect() first.');
    }
    return this.client;
  }

  // Session management
  async setSession(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.getClient().setEx(key, ttlSeconds, value);
  }

  async getSession(key: string): Promise<string | null> {
    return await this.getClient().get(key);
  }

  async deleteSession(key: string): Promise<void> {
    await this.getClient().del(key);
  }

  // Rate limiting
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
    const current = await this.getClient().incr(key);
    
    if (current === 1) {
      await this.getClient().expire(key, windowSeconds);
    }

    const remaining = Math.max(0, limit - current);
    return {
      allowed: current <= limit,
      remaining,
    };
  }

  // Caching
  async setCache(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.getClient().setEx(key, ttlSeconds, value);
    } else {
      await this.getClient().set(key, value);
    }
  }

  async getCache(key: string): Promise<string | null> {
    return await this.getClient().get(key);
  }

  async deleteCache(key: string): Promise<void> {
    await this.getClient().del(key);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.getClient().ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed', { error });
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
      logger.info('Redis connection closed');
    }
  }
}

let redisInstance: RedisConnection | null = null;

export function getRedis(config?: RedisConfig): RedisConnection {
  if (!redisInstance) {
    if (!config) {
      throw new Error('Redis config required for first initialization');
    }
    redisInstance = new RedisConnection(config);
  }
  return redisInstance;
}

export default RedisConnection;
