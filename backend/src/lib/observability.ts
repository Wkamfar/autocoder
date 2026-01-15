/**
 * Observability instrumentation for WIRE2 backend
 * Provides metrics (Prometheus), tracing (OpenTelemetry), and structured logging
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db/prisma.js";

// Prometheus metrics
interface Metrics {
  httpRequestsTotal: Map<string, number>;
  httpRequestDuration: Map<string, number[]>;
  httpRequestErrors: Map<string, number>;
  rateLimitEventsTotal: Map<string, number>;
  cspReportsTotal: Map<string, number>;
  dbQueriesTotal: number;
  dbQueryDuration: number[];
  activeConnections: number;
}

const metrics: Metrics = {
  httpRequestsTotal: new Map(),
  httpRequestDuration: new Map(),
  httpRequestErrors: new Map(),
  rateLimitEventsTotal: new Map(),
  cspReportsTotal: new Map(),
  dbQueriesTotal: 0,
  dbQueryDuration: [],
  activeConnections: 0,
};

/**
 * Get Prometheus metrics in Prometheus text format
 */
export function getPrometheusMetrics(): string {
  const lines: string[] = [];

  // HTTP request counters
  for (const [key, count] of metrics.httpRequestsTotal.entries()) {
    lines.push(`wire2_http_requests_total{method="${key.split(" ")[0]}",route="${key.split(" ")[1]}",status="${key.split(" ")[2]}"} ${count}`);
  }

  // HTTP request duration histograms (simplified - using buckets)
  for (const [key, durations] of metrics.httpRequestDuration.entries()) {
    const sum = durations.reduce((a, b) => a + b, 0);
    const count = durations.length;
    const avg = count > 0 ? sum / count : 0;
    lines.push(`wire2_http_request_duration_seconds_sum{method="${key.split(" ")[0]}",route="${key.split(" ")[1]}"} ${sum / 1000}`);
    lines.push(`wire2_http_request_duration_seconds_count{method="${key.split(" ")[0]}",route="${key.split(" ")[1]}"} ${count}`);
    lines.push(`wire2_http_request_duration_seconds_avg{method="${key.split(" ")[0]}",route="${key.split(" ")[1]}"} ${avg / 1000}`);
  }

  // HTTP error counters
  for (const [key, count] of metrics.httpRequestErrors.entries()) {
    lines.push(`wire2_http_request_errors_total{method="${key.split(" ")[0]}",route="${key.split(" ")[1]}"} ${count}`);
  }

  // Rate limiting events (low-cardinality)
  // key: "<limiter> <scope> <result>"
  for (const [key, count] of metrics.rateLimitEventsTotal.entries()) {
    const [limiter, scope, result] = key.split(" ");
    lines.push(`wire2_rate_limit_events_total{limiter="${limiter}",scope="${scope}",result="${result}"} ${count}`);
  }

  // CSP reports (low-cardinality)
  // key: "<disposition> <directive>"
  for (const [key, count] of metrics.cspReportsTotal.entries()) {
    const [disposition, directive] = key.split(" ");
    lines.push(`wire2_csp_reports_total{disposition="${disposition}",directive="${directive}"} ${count}`);
  }

  // Database metrics
  lines.push(`wire2_db_queries_total ${metrics.dbQueriesTotal}`);
  if (metrics.dbQueryDuration.length > 0) {
    const dbSum = metrics.dbQueryDuration.reduce((a, b) => a + b, 0);
    const dbAvg = dbSum / metrics.dbQueryDuration.length;
    lines.push(`wire2_db_query_duration_seconds_sum ${dbSum / 1000}`);
    lines.push(`wire2_db_query_duration_seconds_count ${metrics.dbQueryDuration.length}`);
    lines.push(`wire2_db_query_duration_seconds_avg ${dbAvg / 1000}`);
  }

  // Active connections
  lines.push(`wire2_active_connections ${metrics.activeConnections}`);

  return lines.join("\n") + "\n";
}

export function recordRateLimitEvent(params: {
  limiter: string;
  scope: string;
  result: "allowed" | "blocked";
}): void {
  const key = `${params.limiter} ${params.scope} ${params.result}`;
  metrics.rateLimitEventsTotal.set(key, (metrics.rateLimitEventsTotal.get(key) || 0) + 1);
}

export function recordCspReport(params: {
  disposition: string;
  directive: string;
}): void {
  // Normalize directive to keep label cardinality bounded
  const disposition = (params.disposition || "unknown").toLowerCase();
  const directive = (params.directive || "unknown").toLowerCase().slice(0, 64);
  const key = `${disposition} ${directive}`;
  metrics.cspReportsTotal.set(key, (metrics.cspReportsTotal.get(key) || 0) + 1);
}

/**
 * Record HTTP request metric
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number
): void {
  const key = `${method} ${route} ${statusCode}`;
  metrics.httpRequestsTotal.set(key, (metrics.httpRequestsTotal.get(key) || 0) + 1);

  const durationKey = `${method} ${route}`;
  if (!metrics.httpRequestDuration.has(durationKey)) {
    metrics.httpRequestDuration.set(durationKey, []);
  }
  metrics.httpRequestDuration.get(durationKey)!.push(durationMs);

  if (statusCode >= 400) {
    const errorKey = `${method} ${route}`;
    metrics.httpRequestErrors.set(errorKey, (metrics.httpRequestErrors.get(errorKey) || 0) + 1);
  }
}

/**
 * Record database query metric
 */
export function recordDbQuery(durationMs: number): void {
  metrics.dbQueriesTotal++;
  metrics.dbQueryDuration.push(durationMs);
  // Keep only last 1000 durations to prevent memory growth
  if (metrics.dbQueryDuration.length > 1000) {
    metrics.dbQueryDuration.shift();
  }
}

/**
 * Increment active connections
 */
export function incrementConnections(): void {
  metrics.activeConnections++;
}

/**
 * Decrement active connections
 */
export function decrementConnections(): void {
  metrics.activeConnections = Math.max(0, metrics.activeConnections - 1);
}

/**
 * Fastify plugin for request/response metrics
 */
export async function metricsPlugin(app: FastifyInstance): Promise<void> {
  // Metrics endpoint
  app.get("/metrics", async (_req: FastifyRequest, reply: FastifyReply) => {
    reply.type("text/plain; version=0.0.4");
    // Best-effort DB-derived metrics (jobs). If DB is down, keep core metrics working.
    const base = getPrometheusMetrics();
    try {
      const jobs = await getJobQueueMetricsPrometheus();
      return base + jobs;
    } catch {
      return base;
    }
  });

  // Request/response hook for metrics
  app.addHook("onRequest", async (request: FastifyRequest) => {
    incrementConnections();
    (request as any).startTime = Date.now();
  });

  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = Date.now() - ((request as any).startTime || Date.now());
    const route = (request as any).routerPath || request.url.split("?")[0];
    recordHttpRequest(request.method, route, reply.statusCode, duration);
    decrementConnections();
  });

  app.addHook("onError", async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    const route = (request as any).routerPath || request.url.split("?")[0];
    const errorKey = `${request.method} ${route}`;
    metrics.httpRequestErrors.set(errorKey, (metrics.httpRequestErrors.get(errorKey) || 0) + 1);
  });
}

let _jobMetricsCache: { at: number; body: string } = { at: 0, body: "" };

async function getJobQueueMetricsPrometheus(): Promise<string> {
  const now = Date.now();
  if (now - _jobMetricsCache.at < 10_000) {
    return _jobMetricsCache.body;
  }

  const rows = await prisma.job.groupBy({
    by: ["status", "type"],
    _count: true,
  });

  const lines: string[] = [];
  for (const r of rows) {
    lines.push(`wire2_jobs_total{type="${r.type}",status="${r.status}"} ${r._count}`);
  }

  const body = lines.join("\n") + (lines.length ? "\n" : "");
  _jobMetricsCache = { at: now, body };
  return body;
}

/**
 * Structured logging helper
 */
export interface LogContext {
  userId?: string;
  orgId?: string;
  intentId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export function logInfo(message: string, context?: LogContext): void {
  const logEntry = {
    level: "info",
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };
  console.log(JSON.stringify(logEntry));
}

export function logError(message: string, error?: Error, context?: LogContext): void {
  const logEntry = {
    level: "error",
    message,
    timestamp: new Date().toISOString(),
    error: error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined,
    ...context,
  };
  console.error(JSON.stringify(logEntry));
}

export function logWarn(message: string, context?: LogContext): void {
  const logEntry = {
    level: "warn",
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };
  console.warn(JSON.stringify(logEntry));
}

/**
 * Logger object for compatibility with existing code
 */
export const logger = {
  info: (message: string, context?: LogContext) => logInfo(message, context),
  warn: (message: string, context?: LogContext) => logWarn(message, context),
  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    const err = error instanceof Error ? error : undefined;
    logError(message, err, context);
  },
};
