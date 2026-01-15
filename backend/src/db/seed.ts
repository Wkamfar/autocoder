import { prisma } from "./prisma.js";
import { canonicalJsonStringify } from "../lib/canonicalJson.js";
import { sha256Hex } from "../lib/sha256.js";

const ORG_ID = "org_acme_corp";

function asDate(iso: string): Date {
  return new Date(iso);
}

function intentBindingSubset(intent: {
  id: string;
  orgId: string;
  createdByUserId: string;
  railsType: "ACH" | "WIRE";
  amountMinor: string;
  currency: string;
  beneficiaryId: string;
  beneficiaryVersion?: number | null;
  purpose: string;
}) {
  return {
    id: intent.id,
    orgId: intent.orgId,
    createdByUserId: intent.createdByUserId,
    railsType: intent.railsType,
    amountMinor: intent.amountMinor,
    currency: intent.currency,
    beneficiaryId: intent.beneficiaryId,
    beneficiaryVersion: intent.beneficiaryVersion ?? null,
    purpose: intent.purpose,
  };
}

function eventHash(params: {
  prevHash: string | null;
  seq: number;
  eventType: string;
  payloadCanonicalJson: string;
  createdByUserId: string;
  createdAt: string;
}) {
  return sha256Hex(
    canonicalJsonStringify({
      prevHash: params.prevHash,
      seq: params.seq,
      eventType: params.eventType,
      payloadCanonicalJson: params.payloadCanonicalJson,
      createdByUserId: params.createdByUserId,
      createdAt: params.createdAt,
    })
  );
}

async function main() {
  // Org
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: { name: "Acme Corporation" },
    create: {
      id: ORG_ID,
      name: "Acme Corporation",
      createdAt: asDate("2025-01-15T10:00:00Z"),
    },
  });

  // Users (seeded demo identities)
  const users = [
    {
      id: "user_alice_smith",
      email: "alice@acme.com",
      name: "Alice Smith",
      role: "TREASURY_INITIATOR" as const,
      permissions: [
        "intent:create",
        "intent:approve",
        "intent:execute",
        "intent:view_events",
        "intent:view_bundle",
        "beneficiary:create",
        "evidence:view",
        "evidence:export_redacted",
      ],
      voiceEnrolled: true,
      enrolledAt: asDate("2025-01-15T10:30:00Z"),
      createdAt: asDate("2025-01-15T10:00:00Z"),
    },
    {
      id: "user_bob_jones",
      email: "bob@acme.com",
      name: "Bob Jones",
      role: "APPROVER" as const,
      permissions: ["intent:approve", "intent:view_events", "intent:view_bundle", "evidence:view", "evidence:export_redacted"],
      voiceEnrolled: true,
      enrolledAt: asDate("2025-01-15T11:00:00Z"),
      createdAt: asDate("2025-01-15T11:00:00Z"),
    },
    {
      id: "user_carol_white",
      email: "carol@acme.com",
      name: "Carol White",
      role: "APPROVER" as const,
      permissions: ["intent:approve", "intent:view_events", "intent:view_bundle", "evidence:view", "evidence:export_redacted"],
      voiceEnrolled: true,
      enrolledAt: asDate("2025-01-15T11:30:00Z"),
      createdAt: asDate("2025-01-15T11:30:00Z"),
    },
    {
      id: "user_admin",
      email: "admin@acme.com",
      name: "Admin User",
      role: "ADMIN" as const,
      permissions: [
        "intent:create",
        "intent:approve",
        "intent:execute",
        "intent:view_events",
        "intent:view_bundle",
        "beneficiary:create",
        "beneficiary:lock",
        "policy:edit",
        "bank:connect",
        "bank:view",
        "bank:admin",
        "evidence:view",
        "evidence:export_full",
        "audit:read",
        "admin:view",
      ],
      voiceEnrolled: true,
      enrolledAt: asDate("2025-01-15T09:00:00Z"),
      createdAt: asDate("2025-01-15T09:00:00Z"),
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        orgId: ORG_ID,
        email: u.email,
        name: u.name,
        role: u.role,
        permissions: u.permissions,
        voiceEnrolled: u.voiceEnrolled,
        enrolledAt: u.enrolledAt,
      },
      create: {
        id: u.id,
        orgId: ORG_ID,
        email: u.email,
        name: u.name,
        role: u.role,
        permissions: u.permissions,
        voiceEnrolled: u.voiceEnrolled,
        enrolledAt: u.enrolledAt,
        createdAt: u.createdAt,
      },
    });
  }

  // Beneficiaries + versions
  const beneficiaries = [
    {
      id: "benef_vendor_abc",
      displayName: "Vendor ABC",
      country: "US",
      railsAllowed: ["ACH", "WIRE"] as const,
      bankLast4: "1234",
      bankTokenHash: "sha256_hash_of_tokenized_bank",
      version: 1,
      status: "ACTIVE" as const,
      createdAt: "2025-01-10T09:00:00Z",
      updatedAt: "2025-01-10T09:00:00Z",
      lastChangedAt: "2025-01-10T09:00:00Z",
      lastChangedBy: "user_admin",
    },
    {
      id: "benef_contractor_xyz",
      displayName: "Contractor XYZ",
      country: "US",
      railsAllowed: ["ACH"] as const,
      bankLast4: "5678",
      bankTokenHash: "sha256_hash_of_tokenized_bank_2",
      version: 1,
      status: "ACTIVE" as const,
      createdAt: "2025-01-12T14:00:00Z",
      updatedAt: "2025-01-12T14:00:00Z",
      lastChangedAt: "2025-01-12T14:00:00Z",
      lastChangedBy: "user_admin",
    },
    {
      id: "benef_international_partner",
      displayName: "International Partner Ltd",
      country: "GB",
      railsAllowed: ["WIRE"] as const,
      bankLast4: "9012",
      bankTokenHash: "sha256_hash_of_tokenized_bank_3",
      version: 1,
      status: "ACTIVE" as const,
      createdAt: "2025-01-18T08:00:00Z",
      updatedAt: "2025-01-18T08:00:00Z",
      lastChangedAt: "2025-01-18T08:00:00Z",
      lastChangedBy: "user_admin",
    },
    {
      id: "benef_recently_changed",
      displayName: "Recently Changed Vendor",
      country: "US",
      railsAllowed: ["ACH"] as const,
      bankLast4: "9999",
      bankTokenHash: "sha256_hash_of_tokenized_bank_4",
      version: 3,
      status: "ACTIVE" as const,
      createdAt: "2025-01-05T10:00:00Z",
      updatedAt: "2025-01-19T15:00:00Z",
      lastChangedAt: "2025-01-19T15:00:00Z",
      lastChangedBy: "user_admin",
    },
  ];

  for (const b of beneficiaries) {
    await prisma.beneficiary.upsert({
      where: { id: b.id },
      update: {
        orgId: ORG_ID,
        displayName: b.displayName,
        country: b.country,
        railsAllowed: [...b.railsAllowed],
        bankLast4: b.bankLast4,
        bankTokenHash: b.bankTokenHash,
        version: b.version,
        status: b.status,
        updatedAt: asDate(b.updatedAt),
        lastChangedAt: asDate(b.lastChangedAt),
        lastChangedBy: b.lastChangedBy,
      },
      create: {
        id: b.id,
        orgId: ORG_ID,
        displayName: b.displayName,
        country: b.country,
        railsAllowed: [...b.railsAllowed],
        bankLast4: b.bankLast4,
        bankTokenHash: b.bankTokenHash,
        version: b.version,
        status: b.status,
        createdAt: asDate(b.createdAt),
        updatedAt: asDate(b.updatedAt),
        lastChangedAt: asDate(b.lastChangedAt),
        lastChangedBy: b.lastChangedBy,
      },
    });

    // Seed a version snapshot for each version number up to current (deterministic placeholders)
    for (let v = 1; v <= b.version; v++) {
      const snapshot = canonicalJsonStringify({
        beneficiaryId: b.id,
        version: v,
        displayName: b.displayName,
        country: b.country,
        railsAllowed: b.railsAllowed,
        bankLast4: b.bankLast4,
        bankTokenHash: b.bankTokenHash,
        status: b.status,
      });
      await prisma.beneficiaryVersion.upsert({
        where: { id: `${b.id}_v${v}` },
        update: { snapshotJson: snapshot },
        create: {
          id: `${b.id}_v${v}`,
          orgId: ORG_ID,
          beneficiaryId: b.id,
          version: v,
          snapshotJson: snapshot,
          createdAt: asDate(b.createdAt),
          createdBy: "user_admin",
        },
      });
    }
  }

  // Policy
  const policyId = "policy_acme_v1";
  await prisma.policy.upsert({
    where: { id: policyId },
    update: { activeVersion: 1, name: "Acme Default Policy", orgId: ORG_ID },
    create: {
      id: policyId,
      orgId: ORG_ID,
      name: "Acme Default Policy",
      activeVersion: 1,
      createdAt: asDate("2025-01-15T00:00:00Z"),
    },
  });

  await prisma.policyVersion.upsert({
    where: { id: `${policyId}_v1` },
    update: {},
    create: {
      id: `${policyId}_v1`,
      policyId,
      version: 1,
      effectiveAt: asDate("2025-01-15T00:00:00Z"),
      thresholdsJson: canonicalJsonStringify({
        amountStepUpMinor: "1000000",
        dualApprovalRiskScore: 60,
        criticalRiskScore: 85,
        newBeneficiaryDays: 7,
        outOfHoursStartHourLocal: 18,
        outOfHoursEndHourLocal: 8,
      }),
      rulesJson: canonicalJsonStringify({
        requireDualApprovalForInternationalWire: true,
        requirePhoneForL3IfMicDenied: true,
        cooldownMinutesForHighRisk: 10,
        lockoutAfterFailedAttempts: 3,
      }),
      createdAt: asDate("2025-01-15T00:00:00Z"),
    },
  });

  // Service health row
  await prisma.serviceHealth.upsert({
    where: { id: "default" },
    update: {
      voiceService: "healthy",
      phoneService: "healthy",
      storageService: "healthy",
      updatedAt: new Date(),
    },
    create: {
      id: "default",
      voiceService: "healthy",
      phoneService: "healthy",
      storageService: "healthy",
      updatedAt: new Date(),
    },
  });

  // Intents (aligned to frontend mock data)
  const intents = [
    {
      id: "intent_high_risk_wire",
      createdByUserId: "user_alice_smith",
      railsType: "WIRE" as const,
      amountMinor: "1500000",
      currency: "USD",
      beneficiaryId: "benef_international_partner",
      beneficiaryVersion: 1,
      purpose: "Q1 2025 vendor payment",
      status: "PENDING_PROOF" as const,
      riskScore: 75,
      riskRationaleJson: {
        factors: ["amount_threshold", "new_beneficiary", "international", "wire_rail"],
        details: {
          amount_threshold: "Amount exceeds $10k threshold",
          new_beneficiary: "Beneficiary created 2 days ago",
          international: "International transfer (GB)",
          wire_rail: "Wire transfer (irreversible)",
        },
        scoreBreakdown: { base: 0, amount: 30, beneficiary: 25, rails: 10, international: 10, total: 75 },
      },
      requiredApprovals: 2,
      requiredChallengeLevel: "L3" as const,
      cooldownUntil: null,
      createdAt: "2025-01-20T09:00:00Z",
      updatedAt: "2025-01-20T09:00:00Z",
    },
    {
      id: "intent_standard_ach",
      createdByUserId: "user_alice_smith",
      railsType: "ACH" as const,
      amountMinor: "725000",
      currency: "USD",
      beneficiaryId: "benef_vendor_abc",
      beneficiaryVersion: 1,
      purpose: "Monthly invoice payment",
      status: "CHALLENGING" as const,
      riskScore: 45,
      riskRationaleJson: {
        factors: ["amount_threshold", "established_beneficiary"],
        details: {
          amount_threshold: "Amount exceeds $5k threshold",
          established_beneficiary: "Beneficiary created 10 days ago",
        },
        scoreBreakdown: { base: 0, amount: 30, beneficiary: 15, total: 45 },
      },
      requiredApprovals: 1,
      requiredChallengeLevel: "L2" as const,
      cooldownUntil: null,
      createdAt: "2025-01-20T10:00:00Z",
      updatedAt: "2025-01-20T10:05:00Z",
    },
    {
      id: "intent_approved_pending_execution",
      createdByUserId: "user_alice_smith",
      railsType: "ACH" as const,
      amountMinor: "250000",
      currency: "USD",
      beneficiaryId: "benef_contractor_xyz",
      beneficiaryVersion: 1,
      purpose: "Contractor payment",
      status: "APPROVED" as const,
      riskScore: 15,
      riskRationaleJson: {
        factors: ["low_amount"],
        details: { low_amount: "Amount below $5k threshold" },
        scoreBreakdown: { base: 0, amount: 0, beneficiary: 15, total: 15 },
      },
      requiredApprovals: 1,
      requiredChallengeLevel: "L1" as const,
      cooldownUntil: null,
      createdAt: "2025-01-20T08:00:00Z",
      updatedAt: "2025-01-20T08:15:00Z",
    },
    {
      id: "intent_executed",
      createdByUserId: "user_alice_smith",
      railsType: "ACH" as const,
      amountMinor: "100000",
      currency: "USD",
      beneficiaryId: "benef_vendor_abc",
      beneficiaryVersion: 1,
      purpose: "Test payment",
      status: "EXECUTED" as const,
      riskScore: 5,
      riskRationaleJson: {
        factors: ["low_amount"],
        details: { low_amount: "Amount below $1k threshold" },
        scoreBreakdown: { base: 0, total: 5 },
      },
      requiredApprovals: 1,
      requiredChallengeLevel: "L1" as const,
      cooldownUntil: null,
      createdAt: "2025-01-19T14:00:00Z",
      updatedAt: "2025-01-19T14:10:00Z",
    },
  ];

  for (const i of intents) {
    const bindingHash = sha256Hex(
      canonicalJsonStringify(
        intentBindingSubset({
          id: i.id,
          orgId: ORG_ID,
          createdByUserId: i.createdByUserId,
          railsType: i.railsType,
          amountMinor: i.amountMinor,
          currency: i.currency,
          beneficiaryId: i.beneficiaryId,
          beneficiaryVersion: i.beneficiaryVersion,
          purpose: i.purpose,
        })
      )
    );

    await prisma.intent.upsert({
      where: { id: i.id },
      update: {
        orgId: ORG_ID,
        createdByUserId: i.createdByUserId,
        railsType: i.railsType,
        amountMinor: i.amountMinor,
        currency: i.currency,
        beneficiaryId: i.beneficiaryId,
        beneficiaryVersion: i.beneficiaryVersion,
        purpose: i.purpose,
        status: i.status,
        riskScore: i.riskScore,
        riskRationaleJson: canonicalJsonStringify(i.riskRationaleJson),
        requiredApprovals: i.requiredApprovals,
        requiredChallengeLevel: i.requiredChallengeLevel,
        bindingHash,
        cooldownUntil: i.cooldownUntil ? asDate(i.cooldownUntil) : null,
        createdAt: asDate(i.createdAt),
        updatedAt: asDate(i.updatedAt),
      },
      create: {
        id: i.id,
        orgId: ORG_ID,
        createdByUserId: i.createdByUserId,
        railsType: i.railsType,
        amountMinor: i.amountMinor,
        currency: i.currency,
        beneficiaryId: i.beneficiaryId,
        beneficiaryVersion: i.beneficiaryVersion,
        purpose: i.purpose,
        status: i.status,
        riskScore: i.riskScore,
        riskRationaleJson: canonicalJsonStringify(i.riskRationaleJson),
        requiredApprovals: i.requiredApprovals,
        requiredChallengeLevel: i.requiredChallengeLevel,
        bindingHash,
        cooldownUntil: i.cooldownUntil ? asDate(i.cooldownUntil) : null,
        createdAt: asDate(i.createdAt),
        updatedAt: asDate(i.updatedAt),
      },
    });
  }

  // Challenges + proof (one deterministic proof)
  await prisma.voiceChallenge.upsert({
    where: { id: "challenge_high_risk_wire" },
    update: {},
    create: {
      id: "challenge_high_risk_wire",
      intentId: "intent_high_risk_wire",
      orgId: ORG_ID,
      language: "EN",
      level: "L3",
      grammarVersion: "v1.0",
      challengeNonce: "river-glass-ember",
      challengeText:
        "FIFTEEN THOUSAND dollars, beneficiary ending NINE ZERO ONE TWO, purpose Q ONE TWO ZERO TWO FIVE, nonce 'river–glass–ember'. Whisper the amount, then say the nonce in reverse order quickly.",
      expectedSlotsJson: canonicalJsonStringify({
        slots: [
          { name: "amount", type: "amount", value: "1500000", spoken: ["fifteen", "thousand"], position: 1 },
          { name: "beneficiary_suffix", type: "digits", value: "9012", spoken: ["nine", "zero", "one", "two"], position: 2 },
          { name: "nonce", type: "words", value: "river-glass-ember", spoken: ["river", "glass", "ember"], position: 4 },
          { name: "nonce_reverse", type: "words", value: "ember-glass-river", spoken: ["ember", "glass", "river"], position: 5 },
        ],
        prosody_modifier: { type: "whisper", target: "amount", instruction: "whisper" },
      }),
      expiresAt: asDate("2025-01-20T10:20:00Z"),
      createdAt: asDate("2025-01-20T10:00:00Z"),
    },
  });

  await prisma.voiceChallenge.upsert({
    where: { id: "challenge_standard_ach" },
    update: {},
    create: {
      id: "challenge_standard_ach",
      intentId: "intent_standard_ach",
      orgId: ORG_ID,
      language: "EN",
      level: "L2",
      grammarVersion: "v1.0",
      challengeNonce: "ocean-mountain-forest",
      challengeText:
        "Authorize transfer: SEVEN TWO FIVE THOUSAND dollars. Beneficiary ending: ONE TWO THREE FOUR. Purpose: MONTHLY INVOICE. Nonce: 'ocean–mountain–forest'. Say the last three words faster.",
      expectedSlotsJson: canonicalJsonStringify({
        slots: [
          { name: "amount", type: "amount", value: "725000", spoken: ["seven", "two", "five", "thousand"], position: 2 },
          { name: "beneficiary_suffix", type: "digits", value: "1234", spoken: ["one", "two", "three", "four"], position: 4 },
          { name: "nonce", type: "words", value: "ocean-mountain-forest", spoken: ["ocean", "mountain", "forest"], position: 6 },
        ],
        prosody_modifier: { type: "speed", target: "nonce", instruction: "faster" },
      }),
      expiresAt: asDate("2025-01-20T10:15:00Z"),
      createdAt: asDate("2025-01-20T10:05:00Z"),
    },
  });

  await prisma.voiceProof.upsert({
    where: { id: "proof_standard_ach" },
    update: {},
    create: {
      id: "proof_standard_ach",
      intentId: "intent_standard_ach",
      orgId: ORG_ID,
      challengeId: "challenge_standard_ach",
      userId: "user_alice_smith",
      channel: "BROWSER",
      transcript:
        "Authorize transfer seven two five thousand dollars beneficiary ending one two three four purpose monthly invoice nonce ocean mountain forest",
      transcriptLanguage: "en",
      scoresJson: canonicalJsonStringify({
        identity_confidence: 0.92,
        liveness_score: 0.88,
        spoof_risk_score: 0.05,
        drift_score: 0.12,
        coercion_risk_score: 0.08,
        challenge_match_score: 0.95,
      }),
      deviceMetadataJson: canonicalJsonStringify({
        ip: "192.168.1.100",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        browser: "Chrome",
        os: "macOS",
      }),
      audioHash: "sha256_hash_of_audio",
      modelVersion: "v2.0",
      createdAt: asDate("2025-01-20T10:06:00Z"),
    },
  });

  // Decisions (seeded) — note: approval tokens are generated at runtime and returned once.
  await prisma.decision.upsert({
    where: { id: "decision_standard_ach" },
    update: {},
    create: {
      id: "decision_standard_ach",
      intentId: "intent_standard_ach",
      orgId: ORG_ID,
      decisionType: "APPROVE",
      reasonCodesJson: canonicalJsonStringify(["voice_verified", "liveness_pass", "challenge_match"]),
      approvalTokenHash: null,
      expiresAt: asDate("2025-01-20T10:16:00Z"),
      signerKeyId: "key_dev_1",
      decisionPayloadCanonicalJson: canonicalJsonStringify({ intentId: "intent_standard_ach", decisionType: "APPROVE" }),
      decisionHash: sha256Hex(canonicalJsonStringify({ intentId: "intent_standard_ach", decisionType: "APPROVE" })),
      signature: "base64_signature",
      policyId,
      policyVersion: 1,
      riskEngineVersion: "v1.0",
      createdByUserId: "user_alice_smith",
      createdAt: asDate("2025-01-20T10:07:00Z"),
    },
  });

  // Event log chain for intent_standard_ach
  const events = [
    {
      id: "event_1",
      intentId: "intent_standard_ach",
      seq: 1,
      eventType: "intent.created",
      payloadCanonicalJson: canonicalJsonStringify({ intentId: "intent_standard_ach", railsType: "ACH" }),
      createdByUserId: "user_alice_smith",
      createdAt: "2025-01-20T10:00:00Z",
    },
    {
      id: "event_2",
      intentId: "intent_standard_ach",
      seq: 2,
      eventType: "challenge.created",
      payloadCanonicalJson: canonicalJsonStringify({ challengeId: "challenge_standard_ach" }),
      createdByUserId: "user_alice_smith",
      createdAt: "2025-01-20T10:05:00Z",
    },
    {
      id: "event_3",
      intentId: "intent_standard_ach",
      seq: 3,
      eventType: "proof.received",
      payloadCanonicalJson: canonicalJsonStringify({ proofId: "proof_standard_ach" }),
      createdByUserId: "user_alice_smith",
      createdAt: "2025-01-20T10:06:00Z",
    },
    {
      id: "event_4",
      intentId: "intent_standard_ach",
      seq: 4,
      eventType: "decision.made",
      payloadCanonicalJson: canonicalJsonStringify({ decisionId: "decision_standard_ach" }),
      createdByUserId: "user_alice_smith",
      createdAt: "2025-01-20T10:07:00Z",
    },
  ];

  let prev: string | null = null;
  for (const e of events) {
    const h = eventHash({ prevHash: prev, ...e });
    await prisma.intentEvent.upsert({
      where: { id: e.id },
      update: { eventHash: h, prevHash: prev },
      create: {
        id: e.id,
        intentId: e.intentId,
        orgId: ORG_ID,
        seq: e.seq,
        eventType: e.eventType,
        payloadCanonicalJson: e.payloadCanonicalJson,
        prevHash: prev,
        eventHash: h,
        createdByUserId: e.createdByUserId,
        createdAt: asDate(e.createdAt),
      },
    });
    prev = h;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

