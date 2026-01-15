/**
 * Agent B: OIDC Integration
 * 
 * OIDC provider integration for internal rollout path
 * Supports standard OIDC flows (authorization code)
 */

import { randomBytes, createHash } from "node:crypto";
import { getOidcConfig } from "./config.js";
import { prisma } from "../../db/prisma.js";
import { logAuthEvent } from "./audit.js";

type OidcStateRecord = {
  createdAt: number;
  used: boolean;
  codeVerifier: string;
  nonce: string;
  orgId?: string;
  returnTo?: string;
};

// In-memory store for OIDC state (in production, use Redis or database)
const stateStore = new Map<string, OidcStateRecord>();

type OidcDiscovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
};

let discoveryCache: { issuer: string; fetchedAt: number; doc: OidcDiscovery } | null = null;
async function getDiscovery(): Promise<OidcDiscovery> {
  const cfg = getOidcConfig();
  const issuer = cfg.issuer.replace(/\/$/, "");
  const now = Date.now();
  if (discoveryCache && discoveryCache.issuer === issuer && now - discoveryCache.fetchedAt < 60 * 60 * 1000) {
    return discoveryCache.doc;
  }
  const res = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed: ${res.status}`);
  }
  const doc = (await res.json()) as OidcDiscovery;
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.userinfo_endpoint) {
    throw new Error("OIDC discovery missing required endpoints");
  }
  discoveryCache = { issuer, fetchedAt: now, doc };
  return doc;
}

// Cleanup old states periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes
  for (const [state, data] of stateStore.entries()) {
    if (now - data.createdAt > maxAge) {
      stateStore.delete(state);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

export type OidcUserInfo = {
  sub: string; // Subject identifier
  email: string;
  name?: string;
  email_verified?: boolean;
  picture?: string;
};

/**
 * Exchange authorization code for tokens and user info
 * In production, use a proper OIDC library (e.g., openid-client)
 */
export async function exchangeCodeForUserInfo(
  code: string,
  state: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ userInfo: OidcUserInfo | null; orgId?: string; returnTo?: string }> {
  const config = getOidcConfig();
  
  if (!config.clientId || !config.clientSecret) {
    throw new Error("OIDC not configured");
  }
  
  // Validate state (CSRF protection) and retrieve PKCE verifier / org binding.
  const st = consumeOidcState(state);
  if (!st) {
    await logAuthEvent({
      eventType: "failed_login",
      ipAddress,
      userAgent,
      details: { reason: "oidc_invalid_state" },
    });
    return { userInfo: null };
  }
  
  try {
    const discovery = await getDiscovery();

    // Exchange code for tokens (PKCE)
    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code_verifier: st.codeVerifier,
      }),
    });
    
    if (!tokenResponse.ok) {
      await logAuthEvent({
        eventType: "failed_login",
        ipAddress,
        userAgent,
        details: { reason: "oidc_token_exchange_failed", status: tokenResponse.status },
      });
      return { userInfo: null, orgId: st.orgId, returnTo: st.returnTo };
    }
    
    const tokens = await tokenResponse.json() as { access_token?: string };
    const accessToken = tokens.access_token;
    
    if (!accessToken) {
      await logAuthEvent({
        eventType: "failed_login",
        ipAddress,
        userAgent,
        details: { reason: "oidc_no_access_token" },
      });
      return { userInfo: null, orgId: st.orgId, returnTo: st.returnTo };
    }
    
    // Fetch user info
    const userInfoResponse = await fetch(discovery.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!userInfoResponse.ok) {
      await logAuthEvent({
        eventType: "failed_login",
        ipAddress,
        userAgent,
        details: { reason: "oidc_userinfo_failed", status: userInfoResponse.status },
      });
      return { userInfo: null, orgId: st.orgId, returnTo: st.returnTo };
    }
    
    const userInfo = await userInfoResponse.json() as OidcUserInfo;
    return { userInfo, orgId: st.orgId, returnTo: st.returnTo };
  } catch (error) {
    await logAuthEvent({
      eventType: "failed_login",
      ipAddress,
      userAgent,
      details: { reason: "oidc_error", error: String(error) },
    });
    return { userInfo: null, orgId: st.orgId, returnTo: st.returnTo };
  }
}

/**
 * Find or create user from OIDC user info
 * Maps OIDC subject to internal user record
 */
export async function findOrCreateUserFromOidc(
  userInfo: OidcUserInfo
): Promise<{ userId: string; orgId: string } | null> {
  // In production, you'd have a mapping table: OidcSubject -> UserId
  // For now, try to find by email (which should be unique)
  
  const user = await prisma.user.findFirst({
    where: { email: userInfo.email },
  });
  
  if (user) {
    return { userId: user.id, orgId: user.orgId };
  }
  
  // If user doesn't exist, you might want to:
  // 1. Create a new user (with default org)
  // 2. Return null and require admin provisioning
  // 3. Use a "default" org for new users
  
  // For now, return null - users must be pre-provisioned
  return null;
}

/**
 * Get OIDC authorization URL with CSRF state
 */
export function getOidcAuthorizationUrl(params?: { orgId?: string; returnTo?: string }): { url: string; state: string } {
  const config = getOidcConfig();
  const state = generateState();
  const nonce = generateState();
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = base64urlSha256(codeVerifier);

  stateStore.set(state, {
    createdAt: Date.now(),
    used: false,
    codeVerifier,
    nonce,
    orgId: params?.orgId,
    returnTo: params?.returnTo,
  });

  // We keep this issuer-based for now; discovery is enforced during callback/token exchange.
  const issuer = config.issuer.replace(/\/$/, "");
  const paramsQs = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return { url: `${issuer}/authorize?${paramsQs.toString()}`, state };
}

function generateState(): string {
  // Use cryptographically secure random bytes
  return randomBytes(32).toString("base64url");
}

function consumeOidcState(state: string): OidcStateRecord | null {
  const stored = stateStore.get(state);
  if (!stored) return null;
  if (stored.used) return null;

  const maxAge = 10 * 60 * 1000;
  if (Date.now() - stored.createdAt > maxAge) {
    stateStore.delete(state);
    return null;
  }
  stored.used = true;
  return stored;
}

function base64urlSha256(input: string): string {
  const hash = createHash("sha256").update(input).digest();
  return Buffer.from(hash).toString("base64url");
}
