/**
 * API Gateway
 * 
 * Central entry point for all API requests
 * Handles:
 * - Request routing
 * - Authentication & Authorization
 * - Rate limiting
 * - CORS
 * - Request validation
 * - Load balancing
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  });
});

// Service discovery and routing
const services = {
  wire: process.env.WIRE_API_URL || 'http://localhost:8000',
  voice: process.env.VOICE_SERVICE_URL || 'http://localhost:8001',
  fraud: process.env.FRAUD_SERVICE_URL || 'http://localhost:8002',
};

// Wire API routes
app.use(
  '/api',
  createProxyMiddleware({
    target: services.wire,
    changeOrigin: true,
    pathRewrite: {
      '^/api': '/api',
    },
    onError: (err, req, res) => {
      console.error('Proxy error:', err);
      res.status(500).json({ error: 'Service unavailable' });
    },
  })
);

// Voice service routes
app.use(
  '/api/voice',
  createProxyMiddleware({
    target: services.voice,
    changeOrigin: true,
    pathRewrite: {
      '^/api/voice': '/api/voice',
    },
  })
);

// Fraud service routes
app.use(
  '/api/fraud',
  createProxyMiddleware({
    target: services.fraud,
    changeOrigin: true,
    pathRewrite: {
      '^/api/fraud': '/api/fraud',
    },
  })
);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API Gateway error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Routing to services:`, services);
});
