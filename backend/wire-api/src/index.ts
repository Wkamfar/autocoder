/**
 * WIRE API Service
 * Core business logic for wire transfers
 * 
 * This service implements:
 * - Authentication & Authorization
 * - Intent Management
 * - Beneficiary Management
 * - Approval Workflow
 * - Policy Engine
 * - Audit Trail
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { getDatabase, DatabaseConfig } from './db/connection';
import { getRedis, RedisConfig } from './db/redis';
import { runMigrations } from './db/migrate';
import { logger } from './utils/logger';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Initialize database connection
const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'wire2',
  user: process.env.DB_USER || 'wire2_user',
  password: process.env.DB_PASSWORD || 'wire2_password',
  ssl: process.env.DB_SSL === 'true',
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
};

const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
};

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const db = getDatabase();
  const redis = getRedis();
  
  const dbHealthy = await db.healthCheck();
  const redisHealthy = await redis.healthCheck();
  
  const status = dbHealthy && redisHealthy ? 'healthy' : 'degraded';
  const statusCode = status === 'healthy' ? 200 : 503;
  
  res.status(statusCode).json({
    status,
    service: 'wire-api',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealthy ? 'ok' : 'failed',
      redis: redisHealthy ? 'ok' : 'failed',
    },
    poolStats: db.getPoolStats(),
  });
});

// Database info endpoint (development only)
if (process.env.NODE_ENV !== 'production') {
  app.get('/health/db', async (req: Request, res: Response) => {
    const db = getDatabase();
    try {
      const result = await db.query('SELECT version()');
      res.json({
        database: 'connected',
        version: result.rows[0].version,
        poolStats: db.getPoolStats(),
      });
    } catch (error) {
      res.status(500).json({ error: 'Database connection failed', details: error });
    }
  });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/intents', require('./routes/intents').default);
app.use('/api/beneficiaries', require('./routes/beneficiaries').default);
app.use('/api/approvals', require('./routes/approvals').default);
app.use('/api/policies', require('./routes/policies').default);
app.use('/api/audit', require('./routes/audit').default);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Initialize services and start server
async function start() {
  try {
    // Initialize database
    logger.info('Initializing database connection...');
    const db = getDatabase(dbConfig);
    await db.connect();
    
    // Run migrations
    logger.info('Running database migrations...');
    await runMigrations();
    
    // Initialize Redis
    logger.info('Initializing Redis connection...');
    const redis = getRedis(redisConfig);
    await redis.connect();
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`WIRE API Service running on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        database: dbConfig.database,
        redis: redisConfig.host,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  const db = getDatabase();
  const redis = getRedis();
  await db.close();
  await redis.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  const db = getDatabase();
  const redis = getRedis();
  await db.close();
  await redis.close();
  process.exit(0);
});

start();
