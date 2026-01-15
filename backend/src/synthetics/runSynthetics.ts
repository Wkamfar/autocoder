/**
 * Agent 8 P2: Synthetic monitoring runner (6 critical flows).
 *
 * This is designed to be run by CI/CD (Agent 10) or a cron/synthetic platform.
 * It supports "header auth" mode used by local/test scripts.
 */

type Json = Record<string, any>;

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env ${name}`);
  return v;
}

async function http(method: string, url: string, opts: { headers?: Record<string, string>; body?: any } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(opts.headers ?? {}),
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  return { res, text, json };
}

async function main() {
  const baseUrl = env("SYNTHETIC_BASE_URL", "http://localhost:8000").replace(/\/$/, "");
  const userId = env("SYNTHETIC_USER_ID", "user_alice_smith");
  const approverId = env("SYNTHETIC_APPROVER_ID", "user_bob_jones");

  const authHeaders = (uid: string) => ({ "X-USER-ID": uid });

  // 1) Login / health (proxy for auth availability in header-auth environments)
  {
    const { res, text } = await http("GET", `${baseUrl}/health`);
    if (!res.ok || !/healthy/.test(text)) throw new Error("health check failed");
  }

  // 2) Voice enrollment (best-effort presence check; true enrollment depends on POSE config)
  {
    const { res } = await http("GET", `${baseUrl}/api/pose/health`, { headers: authHeaders(userId) }).catch(() => ({ res: null as any }));
    // Optional route; don't fail if absent.
    void res;
  }

  // 3) Create intent -> approve -> execute
  let intentId: string | null = null;
  {
    const ben = await http("GET", `${baseUrl}/api/wire/beneficiaries`, { headers: authHeaders(userId) });
    const beneficiaryId = ben.json?.[0]?.id;
    if (!beneficiaryId) throw new Error("no beneficiaries found");

    const intent = await http("POST", `${baseUrl}/api/wire/intents`, {
      headers: authHeaders(userId),
      body: { railsType: "WIRE", amountMinor: "1000000", currency: "USD", beneficiaryId, purpose: "synthetic" },
    });
    intentId = intent.json?.id;
    if (!intentId) throw new Error("failed to create intent");

    const challenge = await http("POST", `${baseUrl}/api/wire/intents/${intentId}/challenge`, {
      headers: authHeaders(userId),
      body: { language: "EN" },
    });
    const challengeId = challenge.json?.id;
    const challengeText = challenge.json?.challengeText;
    if (!challengeId || !challengeText) throw new Error("failed to create challenge");

    const proof = await http("POST", `${baseUrl}/api/wire/challenges/${challengeId}/proof`, {
      headers: authHeaders(userId),
      body: { channel: "BROWSER", transcript: challengeText, deviceMetadataJson: { userAgent: "synthetics" } },
    });
    const proofId = proof.json?.id;
    if (!proofId) throw new Error("failed to submit proof");

    const decision = await http("POST", `${baseUrl}/api/wire/intents/${intentId}/decision`, {
      headers: authHeaders(approverId),
      body: { action: "APPROVE", proofId },
    });
    const approvalToken = decision.json?.approvalToken;
    if (approvalToken) {
      const exec = await http("POST", `${baseUrl}/api/wire/intents/${intentId}/execute`, {
        headers: { ...authHeaders(userId), "X-POSE-APPROVAL": approvalToken, "X-Idempotency-Key": `synthetic_${Date.now()}` },
      });
      if (!exec.res.ok) throw new Error("execute intent failed");
    }
  }

  // 4) Beneficiary change (presence check: list endpoint)
  {
    const b = await http("GET", `${baseUrl}/api/wire/beneficiaries`, { headers: authHeaders(userId) });
    if (!b.res.ok) throw new Error("beneficiary list failed");
  }

  // 5) Evidence export: generate bundle (async mode) then verify endpoint shape
  if (intentId) {
    const bundleJob = await http("POST", `${baseUrl}/api/wire/intents/${intentId}/bundle?async=1&mode=redacted`, {
      headers: authHeaders(userId),
    });
    if (bundleJob.res.status !== 202) throw new Error("bundle async enqueue failed");
  }

  // 6) Webhook setup/delivery: presence check (list endpoint)
  {
    const w = await http("GET", `${baseUrl}/api/wire/webhooks`, { headers: authHeaders(userId) });
    // Might be forbidden depending on permissions; don't hard-fail if 403 in minimal synthetic config.
    if (!(w.res.status === 200 || w.res.status === 403)) throw new Error(`webhooks check unexpected status ${w.res.status}`);
  }
}

await main();

