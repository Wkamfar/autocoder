/**
 * Security reporting endpoints (CSP reports, etc.)
 *
 * These endpoints are intentionally unauthenticated and must be safe to expose.
 */

import type { FastifyPluginAsync } from "fastify";
import { logger, recordCspReport } from "../lib/observability.js";

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + "...";
}

function stripQueryAndFragment(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    // If it's not a valid URL, keep a truncated raw value.
    return truncate(url, 500);
  }
}

function sanitizeCspReport(body: unknown): Record<string, unknown> {
  // CSP reports can arrive in different shapes:
  // - { "csp-report": { ... } } (legacy)
  // - [ { "type": "csp-violation", "body": { ... } } ] (Reporting API)
  //
  // We log a minimal, redacted subset to avoid leaking secrets.
  const b: any = body;

  const legacy = b?.["csp-report"] ?? b?.["csp_report"];
  const reportingApiEntry = Array.isArray(b) ? b[0] : undefined;
  const payload = legacy ?? reportingApiEntry?.body ?? b;

  const docUri = typeof payload?.["document-uri"] === "string" ? payload["document-uri"] : undefined;
  const blockedUri = typeof payload?.["blocked-uri"] === "string" ? payload["blocked-uri"] : undefined;
  const effectiveDirective =
    typeof payload?.["effective-directive"] === "string" ? payload["effective-directive"] : undefined;
  const violatedDirective =
    typeof payload?.["violated-directive"] === "string" ? payload["violated-directive"] : undefined;

  return {
    documentUri: docUri ? stripQueryAndFragment(docUri) : undefined,
    blockedUri: blockedUri ? stripQueryAndFragment(blockedUri) : undefined,
    effectiveDirective,
    violatedDirective,
    disposition: typeof payload?.disposition === "string" ? payload.disposition : undefined,
    statusCode: typeof payload?.["status-code"] === "number" ? payload["status-code"] : undefined,
    sourceFile: typeof payload?.["source-file"] === "string" ? truncate(payload["source-file"], 500) : undefined,
    lineNumber: typeof payload?.["line-number"] === "number" ? payload["line-number"] : undefined,
    columnNumber: typeof payload?.["column-number"] === "number" ? payload["column-number"] : undefined,
  };
}

// Simple in-process alerting hook: if we see too many CSP reports per minute, emit a warn log.
// Intended to be paired with Prometheus alerting on `wire2_csp_reports_total` in production.
let _cspMinuteKey = "";
let _cspMinuteCount = 0;
function maybeWarnHighCspVolume(): void {
  const now = new Date();
  const minuteKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}T${now.getUTCHours()}:${now.getUTCMinutes()}`;
  if (minuteKey !== _cspMinuteKey) {
    _cspMinuteKey = minuteKey;
    _cspMinuteCount = 0;
  }
  _cspMinuteCount++;
  const threshold = Number(process.env.CSP_ALERT_THRESHOLD_PER_MIN || "100");
  if (Number.isFinite(threshold) && threshold > 0 && _cspMinuteCount === threshold) {
    logger.warn("csp_report_volume_threshold_reached", { minuteKey, threshold });
  }
}

export const securityReportsRoutes: FastifyPluginAsync = async (app) => {
  // CSP violation reporting endpoint
  app.post("/security/csp-report", async (req, reply) => {
    const sanitized = sanitizeCspReport(req.body);
    recordCspReport({
      disposition: String((sanitized as any).disposition || "unknown"),
      directive: String((sanitized as any).effectiveDirective || (sanitized as any).violatedDirective || "unknown"),
    });
    maybeWarnHighCspVolume();
    logger.info("csp_report_received", {
      requestId: (req as any).id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      report: sanitized,
    });
    // No content response (standard for report endpoints)
    reply.code(204).send();
  });
};

