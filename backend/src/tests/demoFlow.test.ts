import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { dbAvailable } from "./testDb.js";

// Integration-ish test: assumes DATABASE_URL points at a migrated+seeded Postgres.
// Run with:
//   npm run db:migrate:deploy && npm run db:seed && npm test
//
// Note: In lightweight environments (no Postgres), this test returns early.

describe("wire demo flow", () => {
  it("can create -> challenge -> proof -> approve -> execute", async () => {
    if (!(await dbAvailable())) return;

    const app = await buildApp();
    await app.ready();

    const headersAlice = { "x-user-id": "user_alice_smith", "content-type": "application/json" };
    const headersBob = { "x-user-id": "user_bob_jones", "content-type": "application/json" };

    // Health
    const health = await app.inject({
      method: "GET",
      url: "/api/wire/health",
      headers: headersAlice,
    });
    expect(health.statusCode).toBe(200);

    // Create intent
    const created = await app.inject({
      method: "POST",
      url: "/api/wire/intents",
      headers: headersAlice,
      payload: JSON.stringify({
        railsType: "ACH",
        amountMinor: "100000",
        currency: "USD",
        beneficiaryId: "benef_vendor_abc",
        purpose: "Demo payment",
      }),
    });
    expect(created.statusCode).toBe(201);
    const intent = created.json() as any;
    expect(intent.status).toBe("DRAFT");

    // Challenge
    const challengeRes = await app.inject({
      method: "POST",
      url: `/api/wire/intents/${intent.id}/challenge`,
      headers: headersAlice,
      payload: JSON.stringify({ language: "EN" }),
    });
    expect(challengeRes.statusCode).toBe(200);
    const challenge = challengeRes.json() as any;

    // Proof (Alice)
    const proofRes = await app.inject({
      method: "POST",
      url: `/api/wire/challenges/${challenge.id}/proof`,
      headers: headersAlice,
      payload: JSON.stringify({
        channel: "BROWSER",
        transcript: "Authorize transfer ok",
        transcriptLanguage: "en",
        deviceMetadataJson: { ip: "127.0.0.1" },
      }),
    });
    expect(proofRes.statusCode).toBe(200);
    const proof = proofRes.json() as any;

    // Approve (Bob - maker/checker)
    const decisionRes = await app.inject({
      method: "POST",
      url: `/api/wire/intents/${intent.id}/decision`,
      headers: headersBob,
      payload: JSON.stringify({
        action: "APPROVE",
        proofId: proof.id,
        reasonCodesJson: ["voice_verified"],
      }),
    });
    expect(decisionRes.statusCode).toBe(200);
    const decision = decisionRes.json() as any;
    expect(decision.approvalToken).toBeTruthy();

    // Execute (Alice) using one-time approval token
    const execRes = await app.inject({
      method: "POST",
      url: `/api/wire/intents/${intent.id}/execute`,
      headers: {
        "x-user-id": "user_alice_smith",
        "x-pose-approval": decision.approvalToken,
      },
    });
    expect(execRes.statusCode).toBe(200);
    const exec = execRes.json() as any;
    expect(exec.status).toBe("EXECUTED");

    // Events are chained
    const eventsRes = await app.inject({
      method: "GET",
      url: `/api/wire/intents/${intent.id}/events`,
      headers: headersAlice,
    });
    expect(eventsRes.statusCode).toBe(200);
    const events = eventsRes.json() as any[];
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].prevHash).toBe(null);

    await app.close();
  });
});

