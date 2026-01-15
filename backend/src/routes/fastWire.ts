/**
 * Fast Wire Routes
 * 
 * Public API (no login required) for Fast Wire transfers
 * - Requestor can initiate a Fast Wire with email-based beneficiary
 * - Approver can approve via email link
 * - All actions create POSE network transactions
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { sha256Hex } from "../lib/sha256.js";
import { sendEmail, generateEmailTemplate } from "../modules/email/emailService.js";
import {
  initiatePoseIntent,
  receiveApprovePoseIntent,
  createFinalApprovalPoseTx,
} from "../modules/fastWire/poseTransactions.js";
import {
  generateVerificationCode,
  storeVerificationCode,
  verifyEmailCode,
  isEmailVerificationEnabled,
} from "../modules/fastWire/emailVerification.js";
import { verifyVoice } from "../modules/poseVoice/service.js";
import { logger } from "../lib/observability.js";

export const fastWireRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Create a Fast Wire request (no auth)
   * Requestor initiates a wire transfer with email-based beneficiary
   */
  app.post("/fast-wire/request", async (req, reply) => {
    const bodySchema = z.object({
      role: z.literal("REQUESTOR"),
      amount: z.string().regex(/^\d+\.?\d*$/),
      currency: z.string().length(3).default("USD"),
      purpose: z.string().min(1).max(500),
      beneficiaryEmail: z.string().email(),
      
      // Requestor information
      requestorEmail: z.string().email(),
      requestorName: z.string().min(1).max(200),
      
      // Bank account details (will be encrypted/hashed)
      accountNumber: z.string().min(4).max(20),
      routingNumber: z.string().length(9),
      bankName: z.string().min(1).max(200),
      
      // Voice proof (can be submitted with request or separately)
      voiceProofId: z.string().optional(),
      voiceAudio: z.any().optional(), // Blob/Buffer for voice recording
      
      // Email verification code
      emailVerificationCode: z.string().length(6).optional(),
    });

    const body = bodySchema.parse(req.body);

    // Verify email verification code if provided
    if (body.emailVerificationCode) {
      const codeValid = await verifyEmailCode(body.requestorEmail, body.emailVerificationCode);
      if (!codeValid) {
        return reply.code(400).send({
          error: "Invalid or expired verification code",
          code: "INVALID_VERIFICATION_CODE",
        });
      }
    } else if (isEmailVerificationEnabled()) {
      // Email verification is enabled but no code provided
      return reply.code(400).send({
        error: "Email verification code is required",
        code: "VERIFICATION_CODE_REQUIRED",
      });
    }

    // Verify voice proof if provided
    if (body.voiceProofId) {
      // TODO: Verify voice proof using poseVoice service
      // For now, we'll just store the ID
    }
    
    // Generate unique IDs
    const fastWireId = `fw_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
    const approvalToken = crypto.randomBytes(32).toString("hex");
    const approvalTokenHash = sha256Hex(approvalToken);

    // Hash sensitive bank details
    const accountNumberHash = sha256Hex(body.accountNumber);
    const routingNumberHash = sha256Hex(body.routingNumber);

    // Create Fast Wire record
    const fastWire = await prisma.$transaction(async (tx) => {
      // Create POSE network transaction (initiate intent)
      const poseTx = await initiatePoseIntent({
        requestorEmail: body.requestorEmail,
        requestorName: body.requestorName,
        amountMinor: Math.round(parseFloat(body.amount) * 100).toString(),
        currency: body.currency,
        purpose: body.purpose,
        beneficiaryEmail: body.beneficiaryEmail,
      });
      const poseTxHash = poseTx.txHash;
      
      // Store Fast Wire request
      const record = await tx.fastWire.create({
        data: {
          id: fastWireId,
          status: "PENDING_APPROVAL",
          role: "REQUESTOR",
          amountMinor: Math.round(parseFloat(body.amount) * 100).toString(),
          currency: body.currency.toUpperCase(),
          purpose: body.purpose,
          
          // Requestor info
          requestorEmail: body.requestorEmail,
          requestorName: body.requestorName,
          requestorAccountNumberHash: accountNumberHash,
          requestorRoutingNumberHash: routingNumberHash,
          requestorBankName: body.bankName,
          
          // Beneficiary info (email-based)
          beneficiaryEmail: body.beneficiaryEmail,
          
          // Approval token
          approvalTokenHash,
          
          // POSE network transaction
          requestorPoseTxHash: poseTxHash,
          requestorVoiceProofId: body.voiceProofId || null,
          
          // Email verification
          requestorEmailVerified: !!body.emailVerificationCode,
          requestorEmailVerifiedAt: body.emailVerificationCode ? new Date() : null,
        },
      });

      // Send email to beneficiary
      const approvalUrl = `${process.env.FRONTEND_URL || "http://localhost:3001"}/v2/test?token=${approvalToken}`;
      const shareableUrl = `${process.env.FRONTEND_URL || "http://localhost:3001"}/v2/test?token=${approvalToken}`;
      
      const emailTemplate = generateEmailTemplate("intent_approval_request", {
        name: body.beneficiaryEmail.split("@")[0], // Use email prefix as name
        amount: `${body.currency} ${body.amount}`,
        beneficiary: body.requestorName,
        purpose: body.purpose,
        approvalUrl,
      });
      
      await sendEmail({
        to: body.beneficiaryEmail,
        templateType: "intent_approval_request",
        subject: `Fast Wire Approval Request: ${body.currency} ${body.amount}`,
        bodyHtml: emailTemplate.bodyHtml.replace(
          /Review & Approve/i,
          `<a href="${approvalUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Review Fast Wire</a><p style="margin-top: 12px; font-size: 14px; color: #666;">Or share this link via text: <strong>${shareableUrl}</strong></p>`
        ),
        bodyText: `${emailTemplate.bodyText}\n\nShare this link via text: ${shareableUrl}`,
      });

      return {
        record,
        approvalToken,
        approvalUrl,
        shareableUrl,
      };
    });

    reply.code(201);
    return {
      id: fastWire.record.id,
      status: fastWire.record.status,
      approvalUrl: fastWire.approvalUrl,
      shareableUrl: fastWire.shareableUrl,
      poseTxHash: fastWire.record.requestorPoseTxHash,
      createdAt: fastWire.record.createdAt.toISOString(),
    };
  });

  /**
   * Get Fast Wire details by token (public, no auth)
   * Used when approver clicks email link
   */
  app.get("/fast-wire/:token", async (req, reply) => {
    const paramsSchema = z.object({
      token: z.string().min(32),
    });

    const { token } = paramsSchema.parse(req.params);
    const tokenHash = sha256Hex(token);

    const fastWire = await prisma.fastWire.findFirst({
      where: {
        approvalTokenHash: tokenHash,
        status: {
          in: ["PENDING_APPROVAL", "PENDING_APPROVER_VERIFICATION"],
        },
      },
    });

    if (!fastWire) {
      return reply.code(404).send({
        error: "Fast Wire not found or already processed",
        code: "NOT_FOUND",
      });
    }

    return {
      id: fastWire.id,
      status: fastWire.status,
      amountMinor: fastWire.amountMinor,
      currency: fastWire.currency,
      purpose: fastWire.purpose,
      requestorName: fastWire.requestorName,
      requestorEmail: fastWire.requestorEmail,
      beneficiaryEmail: fastWire.beneficiaryEmail,
      requestorPoseTxHash: fastWire.requestorPoseTxHash,
      approverPoseTxHash: fastWire.approverPoseTxHash,
      finalApprovalPoseTxHash: fastWire.finalApprovalPoseTxHash,
      createdAt: fastWire.createdAt.toISOString(),
    };
  });

  /**
   * Approve Fast Wire (public, no auth)
   * Approver approves the request via email token
   */
  app.post("/fast-wire/:token/approve", async (req, reply) => {
    const paramsSchema = z.object({
      token: z.string().min(32),
    });

    const bodySchema = z.object({
      approverEmail: z.string().email(),
      approverName: z.string().min(1).max(200).optional(),
      
      // Approver bank details (optional - for final TX linking)
      accountNumber: z.string().optional(),
      routingNumber: z.string().optional(),
      bankName: z.string().optional(),
    });

    const { token } = paramsSchema.parse(req.params);
    const body = bodySchema.parse(req.body);
    const tokenHash = sha256Hex(token);

    const result = await prisma.$transaction(async (tx) => {
      // Find Fast Wire request
      const fastWire = await tx.fastWire.findFirst({
        where: {
          approvalTokenHash: tokenHash,
          status: {
            in: ["PENDING_APPROVAL", "PENDING_APPROVER_VERIFICATION"],
          },
        },
      });

      if (!fastWire) {
        throw new Error("Fast Wire not found or already processed");
      }

      if (!fastWire.requestorPoseTxHash) {
        throw new Error("Requestor transaction hash not found");
      }

      // Create POSE network transaction (receive/approve)
      // This creates a transaction linking to the requestor's intent
      const approverPoseTx = await receiveApprovePoseIntent({
        approverEmail: body.approverEmail,
        approverName: body.approverName || body.approverEmail,
        requestorTxHash: fastWire.requestorPoseTxHash,
      });
      const approverPoseTxHash = approverPoseTx.txHash;

      // Update Fast Wire with approver info and TX hash
      const updated = await tx.fastWire.update({
        where: { id: fastWire.id },
        data: {
          status: "BOTH_APPROVED",
          approverEmail: body.approverEmail,
          approverName: body.approverName || null,
          approverPoseTxHash: approverPoseTxHash,
          approverAccountNumberHash: body.accountNumber ? sha256Hex(body.accountNumber) : null,
          approverRoutingNumberHash: body.routingNumber ? sha256Hex(body.routingNumber) : null,
          approverBankName: body.bankName || null,
          approvedAt: new Date(),
        },
      });

      // Create final approval POSE network transaction
      // This shows both accounts approved in one TX, linking all related TXs
      const finalApprovalPoseTx = await createFinalApprovalPoseTx({
        requestorTxHash: fastWire.requestorPoseTxHash,
        approverTxHash: approverPoseTxHash,
        requestorEmail: fastWire.requestorEmail,
        approverEmail: body.approverEmail,
      });
      const finalApprovalPoseTxHash = finalApprovalPoseTx.txHash;
      
      // Final update with linked transaction
      const final = await tx.fastWire.update({
        where: { id: fastWire.id },
        data: {
          status: "COMPLETED",
          finalApprovalPoseTxHash: finalApprovalPoseTxHash,
          completedAt: new Date(),
        },
      });

      // Send confirmation emails
      const amount = (parseInt(fastWire.amountMinor) / 100).toFixed(2);
      
      const requestorEmailTemplate = generateEmailTemplate("intent_executed", {
        name: fastWire.requestorName || fastWire.requestorEmail.split("@")[0],
        amount: `${fastWire.currency} ${amount}`,
        beneficiary: body.approverEmail,
        reference: finalApprovalPoseTxHash,
        viewUrl: `${process.env.FRONTEND_URL || "http://localhost:3001"}/v2/test?token=${token}`,
      });
      
      await sendEmail({
        to: fastWire.requestorEmail,
        templateType: "intent_executed",
        subject: `Fast Wire Approved: ${fastWire.currency} ${amount}`,
        bodyHtml: requestorEmailTemplate.bodyHtml.replace(
          /Transfer Executed/,
          "Fast Wire Approved"
        ).replace(
          /View Details/,
          `View Details (TX: ${finalApprovalPoseTxHash})`
        ),
        bodyText: requestorEmailTemplate.bodyText,
      });

      const approverEmailTemplate = generateEmailTemplate("intent_executed", {
        name: body.approverName || body.approverEmail.split("@")[0],
        amount: `${fastWire.currency} ${amount}`,
        beneficiary: fastWire.requestorEmail,
        reference: finalApprovalPoseTxHash,
        viewUrl: `${process.env.FRONTEND_URL || "http://localhost:3001"}/v2/test?token=${token}`,
      });
      
      await sendEmail({
        to: body.approverEmail,
        templateType: "intent_executed",
        subject: `Fast Wire Approval Confirmed: ${fastWire.currency} ${amount}`,
        bodyHtml: approverEmailTemplate.bodyHtml.replace(
          /Transfer Executed/,
          "Fast Wire Approval Confirmed"
        ).replace(
          /Your transfer has been successfully executed/,
          "Your approval has been recorded. The Fast Wire is now complete."
        ),
        bodyText: approverEmailTemplate.bodyText,
      });

      return final;
    });

    return {
      id: result.id,
      status: result.status,
      requestorPoseTxHash: result.requestorPoseTxHash,
      approverPoseTxHash: result.approverPoseTxHash,
      finalApprovalPoseTxHash: result.finalApprovalPoseTxHash,
      approvedAt: result.approvedAt?.toISOString(),
      completedAt: result.completedAt?.toISOString(),
    };
  });

  /**
   * Submit voice proof for Fast Wire (public, no auth)
   * Requestor submits voice proof as part of Fast Wire creation
   */
  app.post("/fast-wire/submit-voice-proof", async (req, reply) => {
    if (!req.isMultipart()) {
      return reply.code(400).send({ error: "Expected multipart/form-data" });
    }

    const paramsSchema = z.object({
      requestorEmail: z.string().email(),
      audio: z.any(), // Will be handled as multipart file
    });

    try {
      const parts = req.parts();
      const fields: Record<string, any> = {};
      const files: Array<{ buffer: Buffer; filename?: string; mimeType?: string; fieldname: string }> = [];

      for await (const part of parts as any) {
        if (part.type === "file") {
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(chunk));
          }
          files.push({
            buffer: Buffer.concat(chunks),
            filename: part.filename,
            mimeType: part.mimetype,
            fieldname: part.fieldname,
          });
        } else {
          fields[part.fieldname] = part.value;
        }
      }

      const body = z.object({
        requestorEmail: z.string().email(),
      }).parse(fields);

      const audioFile = files.find((f) => f.fieldname === "audio");
      if (!audioFile) {
        return reply.code(400).send({ error: "Missing audio file" });
      }

      // Generate a POSE ID for the requestor (if they don't have one)
      // For Fast Wire, we'll use a temporary POSE ID based on email
      const poseId = `fastwire_${sha256Hex(body.requestorEmail).slice(0, 16)}`;

      // Verify voice against a temporary profile or create one
      // For Fast Wire, we'll do a simple voice verification
      // In production, this should create/update a voice profile
      try {
        // TODO: Integrate with poseVoice service for Fast Wire users
        // For now, we'll generate a proof ID and store it
        const voiceProofId = `vp_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
        
        // Store voice proof metadata (in production, store the actual proof)
        logger.info("Voice proof submitted for Fast Wire", {
          requestorEmail: body.requestorEmail,
          voiceProofId,
          audioSize: audioFile.buffer.length,
        });

        return {
          voiceProofId,
          poseId,
          message: "Voice proof submitted successfully",
        };
      } catch (error: any) {
        logger.error("Voice proof submission failed", { error: error.message });
        return reply.code(500).send({
          error: "Voice proof verification failed",
          code: "VOICE_PROOF_ERROR",
          details: error.message,
        });
      }
    } catch (error: any) {
      return reply.code(400).send({
        error: "Invalid request",
        code: "INVALID_REQUEST",
        details: error.message,
      });
    }
  });

  /**
   * Send email verification code
   */
  app.post("/fast-wire/verify-email", async (req, reply) => {
    const bodySchema = z.object({
      email: z.string().email(),
    });

    const { email } = bodySchema.parse(req.body);

    // Generate 6-digit code
    const code = generateVerificationCode();

    // Store code in Redis with expiration (5 minutes)
    const stored = await storeVerificationCode(email, code);
    
    if (!stored && isEmailVerificationEnabled()) {
      return reply.code(500).send({
        error: "Failed to store verification code",
        code: "STORAGE_ERROR",
      });
    }

    // Send verification email
    const emailTemplate = generateEmailTemplate("password_reset", {
      name: email.split("@")[0],
      resetUrl: "#", // Not used for verification codes
    });

    await sendEmail({
      to: email,
      templateType: "password_reset",
      subject: "Fast Wire Email Verification Code",
      bodyHtml: emailTemplate.bodyHtml.replace(
        /Reset your password/,
        "Fast Wire Email Verification"
      ).replace(
        /Use the secure button below to set a new one/,
        `Your verification code is:<br/><h2 style="font-size: 32px; letter-spacing: 8px; text-align: center; margin: 20px 0; color: #000;">${code}</h2><p>This code will expire in 5 minutes.</p>`
      ).replace(
        /Set new password/,
        code
      ),
      bodyText: `Fast Wire Email Verification\n\nYour verification code is: ${code}\n\nThis code will expire in 5 minutes.`,
    });

    // In production, don't return the code - user should check email
    // But for development/testing, optionally return it
    const returnCode = process.env.NODE_ENV === "development" && process.env.FAST_WIRE_DEBUG_CODES === "true";

    return {
      message: "Verification code sent",
      ...(returnCode ? { code } : {}),
    };
  });
};
