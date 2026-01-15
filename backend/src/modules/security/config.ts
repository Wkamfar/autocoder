/**
 * Agent B: Authentication & Authorization Configuration
 * 
 * AUTH_MODE controls authentication behavior:
 * - "password": Email + password + session tokens (production default)
 * - "oidc": Uses OIDC provider for SSO authentication
 */

export type AuthMode = "password" | "oidc" | "demo";

export function getAuthMode(): AuthMode {
  const mode = process.env.AUTH_MODE?.toLowerCase();
  if (mode === "demo") return "demo";
  if (mode === "oidc") return "oidc";
  return "password"; // Safe default: production password mode
}

export function isOidcMode(): boolean {
  return getAuthMode() === "oidc";
}

/**
 * Feature flag: enable OIDC endpoints even when AUTH_MODE is still "password".
 * This supports safe incremental rollout without breaking demo/password flows.
 */
export function isOidcEnabled(): boolean {
  const v = process.env.OIDC_ENABLED ?? process.env.FEATURE_OIDC;
  if (!v) return isOidcMode();
  return String(v).toLowerCase() === "true" || String(v) === "1";
}

/**
 * Feature flag: enforce org SSO policy (OrgSsoConfig.enforced) on password login.
 * Default: enabled in OIDC mode; otherwise off unless explicitly enabled.
 */
export function isSsoEnforcementEnabled(): boolean {
  const v = process.env.SSO_ENFORCEMENT_ENABLED ?? process.env.FEATURE_SSO_ENFORCEMENT;
  if (!v) return isOidcMode();
  return String(v).toLowerCase() === "true" || String(v) === "1";
}

// OIDC Configuration
export function getOidcConfig() {
  return {
    issuer: process.env.OIDC_ISSUER || "https://accounts.google.com",
    clientId: process.env.OIDC_CLIENT_ID || "",
    clientSecret: process.env.OIDC_CLIENT_SECRET || "",
    redirectUri: process.env.OIDC_REDIRECT_URI || "http://localhost:8000/api/auth/oidc/callback",
    scopes: (process.env.OIDC_SCOPES || "openid email profile").split(" "),
  };
}

// Session Configuration
export const SESSION_CONFIG = {
  accessTokenTTL: 15 * 60 * 1000, // 15 minutes
  refreshTokenTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
  rotationThreshold: 12 * 60 * 60 * 1000, // Rotate refresh token if older than 12 hours
};

// Rate Limiting Configuration
export const RATE_LIMIT_CONFIG = {
  // Per-IP limits
  global: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
  },
  // Per-user limits (after authentication)
  authenticatedUser: {
    windowMs: 15 * 60 * 1000,
    max: 1000,
  },
  // Per-org limits (after authentication) — protects shared tenant resources
  authenticatedOrg: {
    windowMs: 15 * 60 * 1000,
    max: 5000,
  },
  // Login endpoint limits
  login: {
    windowMs: 15 * 60 * 1000,
    // Default (non-demo): allow moderate retries without locking legitimate users out.
    // Demo mode overrides this higher in `rateLimit.ts`.
    max: 20,
  },
  // Challenge/proof endpoints (fraud-sensitive)
  challenge: {
    windowMs: 60 * 1000, // 1 minute
    max: 3,
  },
};
