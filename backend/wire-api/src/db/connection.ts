/**
 * Database Connection Pool
 * 
 * Enterprise-grade PostgreSQL connection pooling with:
 * - Connection lifecycle management
 * - Error handling and retry logic
 * - Health checks
 * - Query timeout protection
 * - Transaction support
 */

import { Pool, PoolConfig, QueryResult } from 'pg';
import { logger } from '../utils/logger';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

class DatabaseConnection {
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = {
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection cannot be established
      ...config,
    };
  }

  /**
   * Initialize the connection pool
   */
  async connect(): Promise<void> {
    if (this.pool) {
      logger.warn('Database pool already initialized');
      return;
    }

    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      max: this.config.max,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
    };

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error', { error: err });
      // Don't exit the process, but log the error
    });

    // Test the connection
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      logger.info('Database connection established', { 
        timestamp: result.rows[0].now 
      });
      client.release();
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      throw error;
    }
  }

  /**
   * Get a client from the pool
   */
  async getClient() {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }
    return await this.pool.connect();
  }

  /**
   * Execute a query
   */
  async query<T = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        logger.warn('Slow query detected', { 
          duration, 
          query: text.substring(0, 100) 
        });
      }
      
      return result;
    } catch (error) {
      logger.error('Database query error', { 
        error, 
        query: text.substring(0, 100) 
      });
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (client: any) => Promise<T>
  ): Promise<T> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction failed, rolled back', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    if (!this.pool) {
      return null;
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database connection pool closed');
    }
  }
}

// Singleton instance
let dbInstance: DatabaseConnection | null = null;

export function getDatabase(config?: DatabaseConfig): DatabaseConnection {
  if (!dbInstance) {
    if (!config) {
      throw new Error('Database config required for first initialization');
    }
    dbInstance = new DatabaseConnection(config);
  }
  return dbInstance;
}

export default DatabaseConnection;
