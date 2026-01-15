/**
 * Health and readiness checks for WIRE2 backend
 * Provides /health (liveness) and /ready (readiness) endpoints
 */

import { prisma } from "../db/prisma.js";
import { logError } from "./observability.js";

export interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  version?: string;
  uptime?: number;
}

export interface ReadinessStatus {
  ready: boolean;
  checks: {
    database: {
      status: "ready" | "not_ready";
      latency?: number;
    };
    redis?: {
      status: "ready" | "not_ready";
      latency?: number;
    };
    poseV2?: {
      status: "ready" | "not_ready" | "degraded";
      latency?: number;
    };
  };
  timestamp: string;
}

let startTime = Date.now();

/**
 * Check database connectivity and latency
 */
async function checkDatabase(): Promise<{ ready: boolean; latency?: number }> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    return { ready: true, latency };
  } catch (error) {
    return { ready: false };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<{ ready: boolean; latency?: number }> {
  try {
    const redisModule = await import("./redis.js").catch(() => null);
    if (!redisModule || !redisModule.redis) {
      return { ready: false }; // Redis not configured
    }
    
    const start = Date.now();
    await redisModule.redis.ping();
    const latency = Date.now() - start;
    return { ready: true, latency };
  } catch (error: any) {
    logError("Redis health check failed", error);
    return { ready: false };
  }
}

/**
 * Check POSE V2 voice service health
 */
async function checkPoseV2(): Promise<{ ready: boolean; degraded?: boolean; latency?: number }> {
  try {
    const { poseV2Client } = await import("../modules/voice/poseV2Client.js");
    const start = Date.now();
    const health = await poseV2Client.healthCheck();
    const latency = Date.now() - start;
    
    if (!health.ok) {
      return { ready: false, degraded: true, latency };
    }
    
    return { ready: true, latency: health.latency || latency };
  } catch (error) {
    // POSE V2 service failure is degraded, not fatal (can fallback to mock)
    return { ready: false, degraded: true };
  }
}

/**
 * Get liveness health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "0.1.0",
    uptime,
  };
}

/**
 * Get readiness status with dependency checks
 */
export async function getReadinessStatus(): Promise<ReadinessStatus> {
  const [dbCheck, redisCheck, poseV2Check] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkPoseV2(),
  ]);

  // Service is ready if database is ready (critical dependency)
  // Redis and POSE V2 are optional but checked
  const ready = dbCheck.ready;

  return {
    ready,
    checks: {
      database: {
        status: dbCheck.ready ? "ready" : "not_ready",
        latency: dbCheck.latency,
      },
      ...(redisCheck.ready !== undefined && {
        redis: {
          status: redisCheck.ready ? "ready" : "not_ready",
          latency: redisCheck.latency,
        },
      }),
      ...(poseV2Check.ready !== undefined && {
        poseV2: {
          status: poseV2Check.degraded ? "degraded" : (poseV2Check.ready ? "ready" : "not_ready"),
          latency: poseV2Check.latency,
        },
      }),
    },
    timestamp: new Date().toISOString(),
  };
}
