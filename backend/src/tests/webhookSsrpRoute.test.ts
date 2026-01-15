import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../db/prisma.js";
import { dbAvailable } from "./testDb.js";

describe("Agent 10: webhook SSRF route guard", () => {
  it("rejects localhost webhook targets by default", async () => {
    if (!(await dbAvailable())) return;

    const prevAllowHttp = process.env.WEBHOOK_ALLOW_HTTP;
    const prevAllowLocalhost = process.env.WEBHOOK_ALLOW_LOCALHOST;
    const prevResolveDns = process.env.WEBHOOK_RESOLVE_DNS;
    process.env.WEBHOOK_ALLOW_HTTP = "true"; // still should reject localhost unless explicitly allowed
    process.env.WEBHOOK_ALLOW_LOCALHOST = "false";
    process.env.WEBHOOK_RESOLVE_DNS = "false"; // avoid DNS reliance

    const app = await buildApp();
    await app.ready();

    try {
      const ts = Date.now();
      const email = `admin_ssrf_${ts}@example.com`;
      const password = "admin-ssrf-123";

      const signup = await app.inject({
        method: "POST",
        url: "/api/signup",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          organizationName: `SSRFCo ${ts}`,
          adminName: "Admin",
          adminEmail: email,
          password,
        }),
      });
      expect(signup.statusCode).toBe(201);

      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ email, password }),
      });
      expect(login.statusCode).toBe(200);
      const token = (login.json() as any).token as string;

      const create = await app.inject({
        method: "POST",
        url: "/api/wire/webhooks",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        payload: JSON.stringify({
          name: "Bad Hook",
          url: "http://localhost:1234/hook",
          events: ["intent.created"],
        }),
      });
      expect(create.statusCode).toBe(400);
      expect((create.json() as any).code).toBe("UNSAFE_OUTBOUND_URL");
    } finally {
      await app.close();
      process.env.WEBHOOK_ALLOW_HTTP = prevAllowHttp;
      process.env.WEBHOOK_ALLOW_LOCALHOST = prevAllowLocalhost;
      process.env.WEBHOOK_RESOLVE_DNS = prevResolveDns;
    }
  });
});

