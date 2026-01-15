import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requirePermission, handleOidcAuth } from "../modules/security/auth.js";
import { getAuthMode } from "../modules/security/config.js";
import { asActivePolicy, asBeneficiary, asDecision, asServiceHealth, asTransferIntent, asVoiceChallenge, asVoiceProof } from "../modules/wire/serializers.js";
import { listIntentEvents, verifyEventChain } from "../modules/evidence/eventChain.js";
import { emitOrgAuditEvent } from "../modules/audit/auditEvents.js";
import { createBeneficiary, listBeneficiaries, updateBeneficiary, getBeneficiaryIntelligence } from "../modules/beneficiaries/beneficiaryService.js";
import { createPolicyVersion, getActivePolicy } from "../modules/policies/policyService.js";
import { canonicalJsonStringify } from "../lib/canonicalJson.js";
import { sha256Hex } from "../lib/sha256.js";
import { invalidateApprovalTokens, mintApprovalToken } from "../modules/approvals/approvalTokens.js";
import { requiredControls, scoreIntent } from "../modules/policies/riskEngine.js";
import { createChallenge, createDecision, createIntent, executeIntent, generateAuditBundle, getIntent, listIntents, submitProof, updateIntent } from "../modules/intents/intentService.js";
import { idempotencyMiddleware, IdempotencyRequest } from "../middleware/idempotency.js";
import { enqueueJob } from "../jobs/jobQueue.js";
import { JOB_TYPES } from "../jobs/jobTypes.js";
import { getExecutionLedgerEntries } from "../modules/intents/executionLedger.js";

export const wireRoutes: FastifyPluginAsync = async (app) => {
  // Agent D: Register idempotency middleware globally for mutating endpoints
  await idempotencyMiddleware()(app);
  
  // Auth hook - ensure user is authenticated for all routes except health
  app.addHook("preHandler", async (req, reply) => {
    // If an earlier hook already sent a response (e.g., global auth hook), do nothing.
    if (reply.sent) {
      return;
    }

    // Skip auth for health endpoint
    if (req.url.endsWith("/health")) {
      return;
    }
    
    // If user already set by parent plugin, skip
    if (req.user) {
      return;
    }
    
    // Run auth
    if (getAuthMode() === "oidc") {
      await handleOidcAuth(req, reply);
    } else {
      // In production password/session mode, the global auth hook should already attach req.user.
      // If it's missing here, treat as unauthenticated.
      if (!reply.sent) {
        reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      return;
    }
    
    if (reply.sent) {
      return;
    }
    
    if (!req.user) {
      reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }
  });
  
  // Health (liveness check)
  app.get("/health", async () => {
    // Service health for UI status chips.
    // This is separate from the orchestration liveness endpoint at root `/health`.
    let row: any = null;
    try {
      row = await prisma.serviceHealth.findUnique({ where: { id: "default" } });
    } catch {
      row = null;
    }
    if (!row) {
      // Safe default: avoid false "down" indicators if the row doesn't exist yet.
      return { voiceService: "healthy", phoneService: "healthy", storageService: "healthy" };
    }
    return asServiceHealth(row);
  });

  // Readiness (dependency checks)
  app.get("/health/ready", async (req, reply) => {
    const { getReadinessStatus } = await import("../lib/health.js");
    const status = await getReadinessStatus();
    if (!status.ready) {
      reply.code(503);
    }
    return status;
  });

  // Metrics endpoint (Prometheus)
  app.get("/metrics", async () => {
    const { getPrometheusMetrics } = await import("../lib/observability.js");
    return getPrometheusMetrics();
  });

  // Intents
  app.get("/intents", async (req, reply) => {
    if (!req.user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }
    const orgId = req.user.orgId;
    const intents = await listIntents(orgId);
    return intents.map(asTransferIntent);
  });

  app.get("/intents/:id", async (req, reply) => {
    const orgId = req.user!.orgId;
    const intent = await getIntent(orgId, (req.params as any).id);
    if (!intent) return reply.code(404).send({ error: "Intent not found" });
    return asTransferIntent(intent);
  });

  // Execution ledger entries for an intent (audit/reconciliation UX)
  app.get("/intents/:id/executions", async (req, reply) => {
    const orgId = req.user!.orgId;
    const intentId = (req.params as any).id as string;
    const intent = await getIntent(orgId, intentId);
    if (!intent) return reply.code(404).send({ error: "Intent not found" });
    const entries = await getExecutionLedgerEntries(intent.id, orgId);
    return entries.map((e: any) => ({
      executionRef: e.executionRef,
      status: e.status,
      state: (e as any).state ?? null,
      provider: (e as any).provider ?? null,
      externalRef: e.externalRef ?? null,
      externalStatus: e.externalStatus ?? null,
      reconciliationStatus: e.reconciliationStatus ?? null,
      reconciliationAt: e.reconciliationAt ? e.reconciliationAt.toISOString() : null,
      errorMessage: e.errorMessage ?? null,
      retryCount: e.retryCount ?? 0,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));
  });

  app.get(
    "/intents/:id/approval-status",
    async (req, reply) => {
      const orgId = req.user!.orgId;
      const intentId = (req.params as any).id as string;
      const intent = await getIntent(orgId, intentId);
      if (!intent) return reply.code(404).send({ error: "Intent not found" });

      // Distinct APPROVE approvals for the current binding hash (invalidated approvals don't count)
      const approvals = await prisma.approval.findMany({
        where: {
          intentId: intent.id,
          bindingHash: intent.bindingHash,
          invalidatedAt: null,
          decisionType: "APPROVE",
        },
        distinct: ["approverUserId"],
        orderBy: { createdAt: "asc" },
        include: {
          approver: { select: { id: true, name: true } },
        },
      });

      const completed = approvals.length;
      const required = intent.requiredApprovals;

      const approvers: Array<{
        userId: string;
        name: string;
        status: "pending" | "completed";
        completedAt: string | null;
      }> = approvals.map((a) => ({
        userId: a.approver.id,
        name: a.approver.name,
        status: "completed",
        completedAt: a.createdAt.toISOString(),
      }));

      // Fill placeholders up to required approvals so UI can render the full "N / required" ladder
      for (let i = approvers.length; i < required; i++) {
        approvers.push({
          userId: `pending_${i + 1}`,
          name: "Pending approver",
          status: "pending",
          completedAt: null,
        });
      }

      return {
        required,
        completed,
        approvers,
      };
    }
  );

  app.post(
    "/intents",
    { preHandler: requirePermission("intent:create") },
    async (req, reply) => {
      const bodySchema = z.object({
        railsType: z.enum(["ACH", "WIRE"]),
        amountMinor: z.string().regex(/^\d+$/),
        currency: z.string().length(3).default("USD"),
        beneficiaryId: z.string().min(1),
        purpose: z.string().min(1),
      });
      const body = bodySchema.parse(req.body);

      const { intent } = await createIntent({
        orgId: req.user!.orgId,
        userId: req.user!.id,
        railsType: body.railsType,
        amountMinor: body.amountMinor,
        currency: body.currency,
        beneficiaryId: body.beneficiaryId,
        purpose: body.purpose,
      });

      reply.code(201);
      return asTransferIntent(intent);
    }
  );

  app.patch(
    "/intents/:id",
    { preHandler: requirePermission("intent:create") },
    async (req, reply) => {
      const bodySchema = z
        .object({
          beneficiaryId: z.string().min(1).optional(),
          purpose: z.string().min(1).optional(),
          amountMinor: z.string().regex(/^\d+$/).optional(),
          railsType: z.enum(["ACH", "WIRE"]).optional(),
        })
        .refine((x) => Object.keys(x).length > 0, { message: "Empty patch" });
      const body = bodySchema.parse(req.body);

      const updated = await updateIntent({
        orgId: req.user!.orgId,
        userId: req.user!.id,
        intentId: (req.params as any).id,
        patch: body,
      });
      if (!updated) return reply.code(404).send({ error: "Intent not found" });
      return asTransferIntent(updated);
    }
  );

  // Challenges / proofs / decisions / execute / events / bundle (wired later)
  app.post("/intents/:id/challenge", async (req, reply) => {
    const bodySchema = z.object({
      language: z.enum(["EN", "ES"]).default("EN"),
    });
    const body = bodySchema.parse(req.body ?? {});
    const challenge = await createChallenge({
      orgId: req.user!.orgId,
      userId: req.user!.id,
      intentId: (req.params as any).id,
      language: body.language,
    });
    if (!challenge) return reply.code(404).send({ error: "Intent not found" });
    return asVoiceChallenge(challenge);
  });

  app.post("/challenges/:challengeId/proof", async (req, reply) => {
    // Handle both multipart/form-data (for audio file) and JSON (for fallback)
    let audioBuffer: Buffer | undefined;
    let body: {
      channel?: "BROWSER" | "PHONE";
      transcript?: string;
      transcriptLanguage?: string | null;
      deviceMetadataJson?: Record<string, unknown>;
    } = {};
    
    if (req.isMultipart()) {
      // Handle multipart/form-data (audio file upload)
      const parts = req.parts();
      const data: Record<string, any> = {};
      
      for await (const part of parts as any) {
        if (part.type === "file" && part.fieldname === "audio") {
          // Read audio file into buffer
          const chunks: Buffer[] = [];
          const fileStream = part as any;
          for await (const chunk of fileStream) {
            chunks.push(chunk);
          }
          audioBuffer = Buffer.concat(chunks);
        } else {
          // Handle other form fields
          data[part.fieldname] = (part as any).value;
        }
      }
      
      body = {
        channel: (data.channel as "BROWSER" | "PHONE") || "BROWSER",
        transcript: data.transcript || "",
        transcriptLanguage: data.transcriptLanguage || null,
        deviceMetadataJson: data.deviceMetadataJson ? JSON.parse(data.deviceMetadataJson) : undefined,
      };
    } else {
      // Handle JSON body (fallback for base64 audio)
      const bodySchema = z.object({
        channel: z.enum(["BROWSER", "PHONE"]).default("BROWSER"),
        transcript: z.string().min(1).default(""),
        transcriptLanguage: z.string().nullable().optional(),
        deviceMetadataJson: z.record(z.any()).optional(),
      });
      body = bodySchema.parse(req.body ?? {});
      
      // Extract audio from deviceMetadata if present
      if (body.deviceMetadataJson?.audioBuffer) {
        audioBuffer = Buffer.from(body.deviceMetadataJson.audioBuffer as string, "base64");
      }
    }
    
    // Add audio buffer to deviceMetadata if we have it
    const deviceMetadata = {
      ...body.deviceMetadataJson,
      ...(audioBuffer ? { audioBuffer: audioBuffer.toString("base64") } : {}),
    };
    
    const proof = await submitProof({
      orgId: req.user!.orgId,
      userId: req.user!.id,
      challengeId: (req.params as any).challengeId,
      channel: body.channel || "BROWSER",
      transcript: body.transcript || "",
      transcriptLanguage: body.transcriptLanguage ?? null,
      deviceMetadata: Object.keys(deviceMetadata).length > 0 ? deviceMetadata : undefined,
    });
    return asVoiceProof(proof);
  });

  app.post(
    "/intents/:id/decision",
    { preHandler: requirePermission("intent:approve") },
    async (req, reply) => {
      const bodySchema = z.object({
        action: z.enum(["APPROVE", "DENY", "STEP_UP"]),
        proofId: z.string().min(1),
        reasonCodesJson: z.array(z.string()).optional(),
      });
      const body = bodySchema.parse(req.body);
      const result = await createDecision({
        orgId: req.user!.orgId,
        userId: req.user!.id,
        intentId: (req.params as any).id,
        decisionType: body.action,
        proofId: body.proofId,
        reasonCodes: body.reasonCodesJson,
      });
      if (!result) return reply.code(404).send({ error: "Intent not found" });

      return {
        ...asDecision(result.decision),
        ...(result.approvalToken ? { approvalToken: result.approvalToken } : {}),
      };
    }
  );

  app.post(
    "/intents/:id/execute",
    { preHandler: requirePermission("intent:execute") },
    async (req, reply) => {
      const bodySchema = z
        .object({
          // Optional: Plaid Transfer sandbox execution recipient details.
          // Do NOT log. Do not send in signed receipts.
          plaidRecipient: z
            .object({
              name: z.string().min(1).max(200),
              routingNumber: z.string().min(3).max(20),
              accountNumber: z.string().min(3).max(50),
            })
            .optional(),
          provider: z.enum(["mock", "plaid"]).optional(),
        })
        .optional();
      const body = bodySchema.parse(req.body ?? {});

      const approvalHeader = req.headers["x-pose-approval"];
      const approvalToken =
        typeof approvalHeader === "string"
          ? approvalHeader
          : Array.isArray(approvalHeader)
            ? approvalHeader[0]
            : undefined;
      if (!approvalToken) return reply.code(400).send({ error: "Missing X-POSE-APPROVAL header" });

      const idempotencyKey = (req as IdempotencyRequest).idempotencyKey;
      const rawIdempotencyKeyHeader =
        typeof req.headers["x-idempotency-key"] === "string"
          ? (req.headers["x-idempotency-key"] as string)
          : Array.isArray(req.headers["x-idempotency-key"])
            ? (req.headers["x-idempotency-key"][0] as string)
            : undefined;
      const result = await executeIntent({
        orgId: req.user!.orgId,
        userId: req.user!.id,
        intentId: (req.params as any).id,
        approvalToken,
        idempotencyKey,
        rawIdempotencyKey: rawIdempotencyKeyHeader,
        provider: (body as any)?.provider ?? (process.env.PLAID_TRANSFER_ENABLED === "true" ? "plaid" : "mock"),
        plaidRecipient: (body as any)?.plaidRecipient ?? null,
      });
      if (!result) return reply.code(404).send({ error: "Intent not found" });
      // Agent 7.1: mint a POSE-signed receipt for execution completion (portable verifier artifact).
      try {
        const { issuePoseVerificationToken } = await import("../modules/verification/poseReceipt.js");
        const receipt = await issuePoseVerificationToken({
          orgId: req.user!.orgId,
          intentId: (req.params as any).id,
          executionRef: (result as any).executionRef,
          receiptType: "execution.completed",
          requestId: req.id,
          traceId: (req as any).traceId ?? null,
        });
        return { ...result, poseReceipt: receipt };
      } catch (error: any) {
        req.log.warn({ error }, "Failed to mint POSE receipt (non-fatal)");
        return result;
      }
    }
  );

  // Executor convenience: mint a fresh approval token for execution (rotates any existing unconsumed tokens)
  // This avoids requiring a manual handoff of the one-time approval token from the final approver.
  app.post(
    "/intents/:id/execution-token",
    { preHandler: requirePermission("intent:execute") },
    async (req, reply) => {
      const orgId = req.user!.orgId;
      const intentId = (req.params as any).id as string;
      const intent = await getIntent(orgId, intentId);
      if (!intent) return reply.code(404).send({ error: "Intent not found" });
      if (intent.status !== "APPROVED") {
        return reply.code(400).send({ error: `Intent must be APPROVED to mint an execution token (current: ${intent.status})` });
      }

      await invalidateApprovalTokens(intent.id);
      const minted = await mintApprovalToken({ intentId: intent.id, orgId: intent.orgId, bindingHash: intent.bindingHash });

      if (!minted.token) {
        // Should not happen after invalidation, but keep a guardrail.
        return reply.code(409).send({ error: "Unable to mint execution token. Please retry." });
      }

      return {
        approvalToken: minted.token,
        expiresAt: minted.expiresAt.toISOString(),
      };
    }
  );

  app.get("/intents/:id/events", async (req, reply) => {
    const intentId = (req.params as any).id;
    const intent = await getIntent(req.user!.orgId, intentId);
    if (!intent) return reply.code(404).send({ error: "Intent not found" });
    const events = await listIntentEvents(intentId, req.user!.orgId);
    return events.map((e) => ({
      id: e.id,
      intentId: e.intentId,
      orgId: e.orgId,
      seq: e.seq,
      eventType: e.eventType,
      payloadCanonicalJson: e.payloadCanonicalJson,
      prevHash: e.prevHash,
      eventHash: e.eventHash,
      poseAnchorTxHash: (e as any).poseAnchorTxHash ?? undefined,
      poseAnchoredAt: (e as any).poseAnchoredAt ? (e as any).poseAnchoredAt.toISOString() : undefined,
      poseAnchorLastError: (e as any).poseAnchorLastError ?? undefined,
      correlationId: e.correlationId ?? undefined,
      requestId: e.requestId ?? undefined,
      createdByUserId: e.createdByUserId,
      createdAt: e.createdAt.toISOString(),
    }));
  });

  // Agent C: Event chain verification endpoint
  app.get("/intents/:id/events/verify", async (req, reply) => {
    const intentId = (req.params as any).id;
    const intent = await getIntent(req.user!.orgId, intentId);
    if (!intent) return reply.code(404).send({ error: "Intent not found" });
    const result = await verifyEventChain(intentId, req.user!.orgId);
    return {
      valid: result.valid,
      errors: result.errors,
      chainHash: result.chainHash,
      eventCount: result.eventCount,
    };
  });

  app.post(
    "/intents/:id/bundle",
    { preHandler: requirePermission("intent:view_bundle") },
    async (req, reply) => {
      const mode = (req.query as any).mode === "redacted" ? "redacted" : "full";
      const asyncMode = (req.query as any).async === "1";

      if (asyncMode) {
        const traceId = (req as any).traceId as string | undefined;
        const job = await enqueueJob({
          type: JOB_TYPES.EVIDENCE_BUNDLE_GENERATE,
          payload: {
            orgId: req.user!.orgId,
            userId: req.user!.id,
            intentId: (req.params as any).id,
            mode,
            traceId,
            requestId: req.id,
          },
          uniqueKey: `bundle:${req.user!.orgId}:${(req.params as any).id}:${mode}`,
          maxAttempts: 5,
        });
        return reply.code(202).send({ accepted: true, jobId: job.id });
      }

      const bundle = await generateAuditBundle({
        orgId: req.user!.orgId,
        userId: req.user!.id,
        intentId: (req.params as any).id,
        mode,
      });
      if (!bundle) return reply.code(404).send({ error: "Intent not found" });
      return {
        id: bundle.id,
        intentId: bundle.intentId,
        mode: (bundle as any).mode ?? mode,
        bundleHash: bundle.bundleHash,
        chainHash: (bundle as any).chainHash ?? null,
        manifestCanonicalJson: bundle.manifestCanonicalJson,
        manifestSignature: bundle.manifestSignature,
        signerKeyId: bundle.signerKeyId,
        storageRef: bundle.storageRef,
        createdAt: bundle.createdAt.toISOString(),
      };
    }
  );

  // Agent C: Bundle verification endpoint
  app.get("/bundles/:id/verify", { preHandler: requirePermission("intent:view_bundle") }, async (req, reply) => {
    const { verifyBundleSignature } = await import("../modules/evidence/bundleVerification.js");
    const bundleId = (req.params as any).id;
    // Tenant guardrail
    const bundle = await prisma.auditBundle.findFirst({
      where: { id: bundleId, intent: { orgId: req.user!.orgId } },
    });
    if (!bundle) {
      return reply.code(404).send({ error: "Bundle not found" });
    }

    const result = await verifyBundleSignature(bundleId);
    if (!result.valid && result.error === "Bundle not found") {
      return reply.code(404).send({ error: "Bundle not found" });
    }
    return result;
  });

  // Agent C: Bundle download endpoint (presigned URL)
  app.get("/bundles/:id/download", { preHandler: requirePermission("intent:view_bundle") }, async (req, reply) => {
    const { getStorage } = await import("../lib/storage/index.js");
    const bundleId = (req.params as any).id;
    
    // Agent 4: tenant guardrail — only resolve bundles attached to intents in this org.
    const bundle = await prisma.auditBundle.findFirst({
      where: { id: bundleId, intent: { orgId: req.user!.orgId } },
    });
    if (!bundle) {
      return reply.code(404).send({ error: "Bundle not found" });
    }

    // Check permission
    const intent = await getIntent(req.user!.orgId, bundle.intentId);
    if (!intent) {
      return reply.code(404).send({ error: "Intent not found" });
    }

    const storage = getStorage();
    const expiresIn = parseInt((req.query as any).expiresIn || "3600", 10);
    const url = await storage.getUrl(bundleId, expiresIn);

    // Best-effort: log download audit trail + emit intent event.
    try {
      const { logBundleDownload } = await import("../modules/evidence/downloadAudit.js");
      await logBundleDownload({
        orgId: req.user!.orgId,
        userId: req.user!.id,
        bundleId: bundle.id,
        intentId: bundle.intentId,
        mode: (bundle as any).mode ?? "full",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } catch (error) {
      req.log.warn({ error }, "Failed to log bundle download audit trail");
    }

    return {
      url,
      expiresIn,
      bundleId: bundle.id,
      intentId: bundle.intentId,
    };
  });

  // Agent 6: Decision signature verification (court-ready “did the system sign this decision?”)
  app.get(
    "/decisions/:id/verify",
    { preHandler: requirePermission("audit:read") },
    async (req, reply) => {
      const decisionId = (req.params as any).id as string;
      const decision = await prisma.decision.findFirst({
        where: { id: decisionId, intent: { orgId: req.user!.orgId } },
      });
      if (!decision) return reply.code(404).send({ error: "Decision not found" });

      const { verifyEd25519 } = await import("../lib/signing.js");
      const { getSigningKey, isKeyRevoked } = await import("../lib/keyManagement.js");

      try {
        const key = await getSigningKey(decision.signerKeyId);
        const valid = verifyEd25519(
          decision.decisionPayloadCanonicalJson,
          decision.signature,
          key.publicKey
        );
        return {
          valid,
          signerKeyId: decision.signerKeyId,
          decisionHash: decision.decisionHash,
          revoked: isKeyRevoked(decision.signerKeyId),
        };
      } catch (error: any) {
        return {
          valid: false,
          signerKeyId: decision.signerKeyId,
          decisionHash: decision.decisionHash,
          revoked: isKeyRevoked(decision.signerKeyId),
          error: error?.message || "Verification error",
        };
      }
    }
  );

  // Beneficiaries
  app.get("/beneficiaries", async (req, reply) => {
    if (!req.user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }
    const beneficiaries = await listBeneficiaries(req.user.orgId);
    return beneficiaries.map(asBeneficiary);
  });

  app.post(
    "/beneficiaries",
    { preHandler: requirePermission("beneficiary:create") },
    async (req, reply) => {
      const bodySchema = z.object({
        displayName: z.string().min(1),
        email: z.string().email().optional(),
        country: z.string().min(2).max(2),
        railsAllowed: z.array(z.enum(["ACH", "WIRE"])).min(1),
        bankLast4: z.string().min(4).max(4),
        // Optional for UI flows; if omitted we generate a secure hash server-side.
        bankTokenHash: z.string().min(1).optional(),
      });
      const body = bodySchema.parse(req.body);
      const bankTokenHash =
        body.bankTokenHash ||
        sha256Hex(
          canonicalJsonStringify({
            orgId: req.user!.orgId,
            displayName: body.displayName,
            bankLast4: body.bankLast4,
            ts: Date.now(),
          })
        );
      const { beneficiary: created, confirmationToken } = await createBeneficiary({
        orgId: req.user!.orgId,
        userId: req.user!.id,
        displayName: body.displayName,
        email: body.email,
        country: body.country,
        railsAllowed: body.railsAllowed,
        bankLast4: body.bankLast4,
        bankTokenHash,
      });
      
      // Send confirmation email if email is provided
      if (body.email && confirmationToken) {
        try {
          const { sendEmail, generateEmailTemplate } = await import("../modules/email/emailService.js");
          const { enqueueEmail } = await import("../modules/email/emailJobs.js");
          const baseUrl = (process.env.FRONTEND_URL || "https://wire.pose.xyz").replace(/\/$/, "");
          const confirmationUrl = `${baseUrl}/v2/beneficiaries/confirm?token=${encodeURIComponent(confirmationToken)}`;
          
          req.log.info({ beneficiaryId: created.id, email: body.email, emailProvider: process.env.EMAIL_PROVIDER || "console" }, "Preparing to send beneficiary confirmation email");
          
          const emailTemplate = generateEmailTemplate("user_invitation", {
            name: body.displayName,
            invitationUrl: confirmationUrl,
            orgName: req.user!.orgId, // Could fetch org name if needed
          });
          
          const emailOptions = {
            to: body.email,
            templateType: "user_invitation" as const,
            subject: `Confirm your beneficiary account - ${body.displayName}`,
            bodyHtml: emailTemplate.bodyHtml.replace(
              /{{invitationUrl}}/g,
              confirmationUrl
            ).replace(
              /{{name}}/g,
              body.displayName
            ),
            bodyText: emailTemplate.bodyText.replace(
              /{{invitationUrl}}/g,
              confirmationUrl
            ).replace(
              /{{name}}/g,
              body.displayName
            ),
            variables: {
              name: body.displayName,
              invitationUrl: confirmationUrl,
            },
          };
          
          if (process.env.EMAIL_ASYNC === "true") {
            req.log.info({ beneficiaryId: created.id, email: body.email }, "Enqueuing beneficiary confirmation email");
            await enqueueEmail({ ...emailOptions, orgId: req.user!.orgId, userId: req.user!.id });
            req.log.info({ beneficiaryId: created.id, email: body.email }, "Beneficiary confirmation email enqueued");
          } else {
            req.log.info({ 
              beneficiaryId: created.id, 
              email: body.email, 
              emailProvider: process.env.EMAIL_PROVIDER || "console",
              mailgunDomain: process.env.MAILGUN_DOMAIN || "not set",
              fromEmail: process.env.FROM_EMAIL || "not set"
            }, "Sending beneficiary confirmation email synchronously");
            const result = await sendEmail(emailOptions);
            if (result.success) {
              req.log.info({ 
                beneficiaryId: created.id, 
                email: body.email, 
                messageId: result.messageId,
                emailProvider: process.env.EMAIL_PROVIDER || "console"
              }, "Beneficiary confirmation email sent successfully");
            } else {
              req.log.error({ 
                beneficiaryId: created.id, 
                email: body.email, 
                error: result.error,
                emailProvider: process.env.EMAIL_PROVIDER || "console"
              }, "Beneficiary confirmation email failed to send");
            }
          }
        } catch (err: any) {
          req.log.error({ err: err?.message || err, stack: err?.stack, beneficiaryId: created.id, email: body.email }, "Failed to send beneficiary confirmation email");
          // Don't fail beneficiary creation if email fails
        }
      } else {
        if (body.email && !confirmationToken) {
          req.log.warn({ beneficiaryId: created.id, email: body.email }, "Email provided but no confirmation token generated");
        }
      }
      
      await emitOrgAuditEvent({
        req,
        eventType: "beneficiary.created",
        subject: { type: "beneficiary", id: created.id },
        payload: {
          displayName: created.displayName,
          email: created.email,
          country: created.country,
          railsAllowed: created.railsAllowed,
          bankLast4: created.bankLast4,
          status: created.status,
          version: created.version,
        },
      });
      reply.code(201);
      return asBeneficiary(created);
    }
  );

  app.patch(
    "/beneficiaries/:id",
    { preHandler: requirePermission("beneficiary:create") },
    async (req, reply) => {
      const bodySchema = z.object({
        displayName: z.string().min(1).optional(),
        country: z.string().min(2).max(2).optional(),
        railsAllowed: z.array(z.enum(["ACH", "WIRE"])).min(1).optional(),
        bankLast4: z.string().min(4).max(4).optional(),
        bankTokenHash: z.string().min(1).optional(),
        status: z.enum(["ACTIVE", "LOCKED", "PENDING_VERIFICATION"]).optional(),
      });
      const body = bodySchema.parse(req.body);
      const updated = await updateBeneficiary({
        orgId: req.user!.orgId,
        userId: req.user!.id,
        beneficiaryId: (req.params as any).id,
        patch: body,
      });
      if (!updated) return reply.code(404).send({ error: "Beneficiary not found" });
      await emitOrgAuditEvent({
        req,
        eventType: "beneficiary.updated",
        subject: { type: "beneficiary", id: updated.id },
        payload: {
          patch: {
            displayName: body.displayName,
            country: body.country,
            railsAllowed: body.railsAllowed,
            bankLast4: body.bankLast4,
            status: body.status,
          },
          // Never include bankTokenHash
          resulting: {
            status: updated.status,
            version: updated.version,
            lastChangedAt: updated.lastChangedAt?.toISOString?.() ?? null,
            lastChangedBy: updated.lastChangedBy,
          },
        },
      });
      return asBeneficiary(updated);
    }
  );

  // Get beneficiary intelligence (real data from intents)
  app.get("/beneficiaries/:id/intelligence", async (req, reply) => {
    if (!req.user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }
    
    const beneficiaryId = (req.params as any).id;
    const intelligence = await getBeneficiaryIntelligence({
      orgId: req.user.orgId,
      beneficiaryId,
    });

    if (!intelligence) {
      return reply.code(404).send({ error: "Beneficiary not found" });
    }

    return intelligence;
  });

  // Policies
  app.get("/policies", async (req, reply) => {
    const policyPack = await getActivePolicy(req.user!.orgId);
    if (!policyPack) return reply.code(404).send({ error: "No policy configured" });
    return asActivePolicy(policyPack.policy, policyPack.version);
  });

  app.post(
    "/policies",
    { preHandler: requirePermission("policy:edit") },
    async (req: any, reply: any) => {
      const bodySchema = z.object({
        policyId: z.string().min(1).default("policy_acme_v1"),
        thresholds: z.object({
          amountStepUpMinor: z.string().regex(/^\d+$/),
          dualApprovalRiskScore: z.number().min(0).max(100),
          criticalRiskScore: z.number().min(0).max(100),
          newBeneficiaryDays: z.number().int().min(0),
          outOfHoursStartHourLocal: z.number().int().min(0).max(23),
          outOfHoursEndHourLocal: z.number().int().min(0).max(23),
        }),
        rules: z.object({
          requireDualApprovalForInternationalWire: z.boolean(),
          requirePhoneForL3IfMicDenied: z.boolean(),
          cooldownMinutesForHighRisk: z.number().int().min(0),
          lockoutAfterFailedAttempts: z.number().int().min(1),
        }),
      });
      const body = bodySchema.parse(req.body);

      const { policy, version } = await createPolicyVersion({
        orgId: req.user!.orgId,
        policyId: body.policyId,
        thresholds: body.thresholds,
        rules: body.rules,
      });

      await emitOrgAuditEvent({
        req,
        eventType: "policy.version_created",
        subject: { type: "policy", id: policy.id },
        payload: {
          policyId: policy.id,
          version: version.version,
          thresholds: body.thresholds,
          rules: body.rules,
        },
      });

      reply.code(201);
      return asActivePolicy(policy, version);
    }
  );

  app.post("/policies/simulate", async (req: any, reply: any) => {
    const bodySchema = z.object({
      railsType: z.enum(["ACH", "WIRE"]),
      amountMinor: z.string().regex(/^\d+$/),
      beneficiaryId: z.string().min(1),
    });
    const body = bodySchema.parse(req.body);
    const beneficiary = await prisma.beneficiary.findFirst({
      where: { id: body.beneficiaryId, orgId: req.user!.orgId },
    });
    if (!beneficiary) {
      return reply.code(404).send({ error: "Beneficiary not found" });
    }
    const policyPack = await getActivePolicy(req.user!.orgId);
    if (!policyPack) return reply.code(404).send({ error: "No policy configured" });
    const thresholds = JSON.parse(policyPack.version.thresholdsJson);
    const rules = JSON.parse(policyPack.version.rulesJson);
    const { riskScore, riskRationale } = scoreIntent({
      amountMinor: body.amountMinor,
      railsType: body.railsType,
      beneficiary,
      policy: { thresholds, rules },
    });
    const { requiredApprovals, requiredChallengeLevel } = requiredControls({
      riskScore,
      railsType: body.railsType,
      beneficiaryCountry: beneficiary.country,
      policy: { thresholds, rules },
    });

    return {
      riskScore,
      riskRationaleJson: riskRationale,
      requiredApprovals,
      requiredChallengeLevel,
      policyId: policyPack.policy.id,
      policyVersion: policyPack.version.version,
      riskEngineVersion: "v1.0",
      requestCanonicalJson: canonicalJsonStringify(body),
    };
  });
};

