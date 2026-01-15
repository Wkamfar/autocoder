import { describe, expect, it } from "vitest";
import { assertSafeOutboundUrl } from "../lib/outboundUrlSafety.js";

describe("Agent 5: outbound URL safety (SSRF guardrails)", () => {
  it("allows https public targets", async () => {
    await expect(assertSafeOutboundUrl("https://example.com/webhook", { resolveDns: false })).resolves.toBeUndefined();
  });

  it("rejects localhost", async () => {
    await expect(assertSafeOutboundUrl("http://localhost:1234/hook", { allowHttp: true, resolveDns: false }))
      .rejects.toThrow(/localhost/i);
  });

  it("rejects private IPv4 targets", async () => {
    await expect(assertSafeOutboundUrl("http://127.0.0.1:8000/hook", { allowHttp: true, resolveDns: false }))
      .rejects.toThrow();
    await expect(assertSafeOutboundUrl("http://10.0.0.1/hook", { allowHttp: true, resolveDns: false }))
      .rejects.toThrow();
    await expect(assertSafeOutboundUrl("http://169.254.169.254/latest/meta-data", { allowHttp: true, resolveDns: false }))
      .rejects.toThrow();
  });

  it("rejects private IPv6 targets", async () => {
    await expect(assertSafeOutboundUrl("http://[::1]/hook", { allowHttp: true, resolveDns: false }))
      .rejects.toThrow();
    await expect(assertSafeOutboundUrl("http://[fe80::1]/hook", { allowHttp: true, resolveDns: false }))
      .rejects.toThrow();
  });

  it("rejects non-http(s) schemes", async () => {
    await expect(assertSafeOutboundUrl("file:///etc/passwd", { resolveDns: false })).rejects.toThrow();
    await expect(assertSafeOutboundUrl("gopher://example.com", { resolveDns: false })).rejects.toThrow();
  });
});

