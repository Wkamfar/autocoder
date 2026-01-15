import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("Agent 5: security headers baseline", () => {
  it("sets baseline security headers on responses", async () => {
    const app = await buildApp();
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);

    // Baseline headers should always be present
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

    await app.close();
  });

  it("enables HSTS + CSP when AUTH_MODE=oidc", async () => {
    const prev = process.env.AUTH_MODE;
    const prevCspMode = process.env.CSP_MODE;
    process.env.AUTH_MODE = "oidc";
    const app = await buildApp();
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
    // Default CSP mode is report-only.
    expect(res.headers["content-security-policy-report-only"]).toContain("default-src");
    expect(res.headers["reporting-endpoints"]).toContain("csp=");

    await app.close();
    process.env.AUTH_MODE = prev;
    process.env.CSP_MODE = prevCspMode;
  });

  it("supports CSP enforce mode when CSP_MODE=enforce", async () => {
    const prevAuth = process.env.AUTH_MODE;
    const prevCspMode = process.env.CSP_MODE;
    process.env.AUTH_MODE = "oidc";
    process.env.CSP_MODE = "enforce";

    const app = await buildApp();
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-security-policy"]).toContain("default-src");

    await app.close();
    process.env.AUTH_MODE = prevAuth;
    process.env.CSP_MODE = prevCspMode;
  });
});

