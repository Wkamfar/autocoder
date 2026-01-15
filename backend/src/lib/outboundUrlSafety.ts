/**
 * Outbound URL safety helpers (SSRF guardrails)
 *
 * Bank-grade default: do not allow webhook/integration targets that resolve to
 * localhost / private / link-local / metadata networks.
 *
 * Notes:
 * - This is a pragmatic baseline. Full DNS-rebinding resistance requires pinning
 *   resolution at connection time (custom agent / lookup). We still re-check at send time
 *   and disable redirects to reduce exposure.
 */

import { lookup } from "node:dns/promises";
import net from "node:net";

export class UnsafeOutboundUrlError extends Error {
  code = "UNSAFE_OUTBOUND_URL" as const;
  constructor(message: string) {
    super(message);
    this.name = "UnsafeOutboundUrlError";
  }
}

function isIpLiteral(hostname: string): boolean {
  return net.isIP(hostname) !== 0;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return false;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique-local fc00::/7
  if (normalized === "::") return true;
  return false;
}

function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) return isPrivateIPv4(ip);
  if (v === 6) return isPrivateIPv6(ip);
  return false;
}

export async function assertSafeOutboundUrl(
  rawUrl: string,
  opts?: { allowHttp?: boolean; allowLocalhost?: boolean; resolveDns?: boolean }
): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeOutboundUrlError("Invalid URL");
  }

  const allowHttp = opts?.allowHttp ?? false;
  const allowLocalhost = opts?.allowLocalhost ?? false;
  const resolveDns = opts?.resolveDns ?? true;

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    throw new UnsafeOutboundUrlError("Only http/https URLs are allowed");
  }
  if (protocol === "http:" && !allowHttp) {
    throw new UnsafeOutboundUrlError("Insecure http URLs are not allowed");
  }

  if (url.username || url.password) {
    throw new UnsafeOutboundUrlError("Userinfo in URLs is not allowed");
  }

  // Node's WHATWG URL can preserve brackets for IPv6 literals in `hostname` (e.g. "[::1]").
  // Normalize so IP detection works reliably.
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname) throw new UnsafeOutboundUrlError("URL hostname is required");

  if (!allowLocalhost) {
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      throw new UnsafeOutboundUrlError("localhost targets are not allowed");
    }
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      throw new UnsafeOutboundUrlError("Local/internal DNS targets are not allowed");
    }
  }

  // Block obvious private networks for IP-literal targets
  if (isIpLiteral(hostname) && isPrivateIp(hostname)) {
    throw new UnsafeOutboundUrlError("Private or loopback IP targets are not allowed");
  }

  // Best-effort DNS resolution check for domain targets
  if (resolveDns && !isIpLiteral(hostname)) {
    try {
      const results = await lookup(hostname, { all: true, verbatim: true });
      if (!results?.length) {
        throw new UnsafeOutboundUrlError("Hostname did not resolve");
      }
      for (const r of results) {
        if (isPrivateIp(r.address)) {
          throw new UnsafeOutboundUrlError("Hostname resolves to a private or loopback IP");
        }
      }
    } catch (e) {
      if (e instanceof UnsafeOutboundUrlError) throw e;
      // If DNS fails, be conservative and reject.
      throw new UnsafeOutboundUrlError("Hostname resolution failed");
    }
  }
}

