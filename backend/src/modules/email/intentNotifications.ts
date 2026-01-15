/**
 * Intent Email Notifications
 * 
 * Sends email notifications for intent lifecycle events:
 * - Approval requests
 * - Approval completed
 * - Execution completed
 * 
 * All emails include blockchain ledger links when available.
 */

import { prisma } from "../../db/prisma.js";
import { sendEmail, generateEmailTemplate } from "./emailService.js";
import { enqueueEmail } from "./emailJobs.js";

/**
 * Generate blockchain explorer link from POSE transaction hash
 */
export function getBlockchainExplorerLink(txHash: string | null | undefined): string | null {
  if (!txHash) return null;
  
  const explorerUrl = process.env.POSE_EXPLORER_URL || "https://explorer.testnet.pose.xyz";
  return `${explorerUrl}/tx/${txHash}`;
}

/**
 * Get all approvers for an organization
 * Approvers are users with APPROVER role or intent:approve permission
 */
export async function getApprovers(orgId: string): Promise<Array<{ id: string; email: string; name: string }>> {
  const approvers = await prisma.user.findMany({
    where: {
      orgId,
      OR: [
        { role: "APPROVER" },
        { role: "ADMIN" }, // Admins can also approve
        { permissions: { has: "intent:approve" } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });
  
  return approvers;
}

/**
 * Send approval request emails when intent needs approval
 */
export async function sendApprovalRequestEmails(params: {
  orgId: string;
  intentId: string;
  intent: {
    id: string;
    amountMinor: string;
    currency: string;
    purpose: string;
    createdByUserId: string;
  };
  beneficiary: {
    name: string;
    accountNumberLast4?: string;
  };
  requiredApprovals: number;
}): Promise<void> {
  const { orgId, intentId, intent, beneficiary, requiredApprovals } = params;
  
  // Get approvers
  const approvers = await getApprovers(orgId);
  if (approvers.length === 0) {
    console.warn(`No approvers found for org ${orgId}`);
    return;
  }
  
  // Get initiator
  const initiator = await prisma.user.findUnique({
    where: { id: intent.createdByUserId },
    select: { name: true, email: true },
  });
  
  // Get organization
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  
  const baseUrl = (process.env.FRONTEND_URL || "https://wire.pose.xyz").replace(/\/$/, "");
  const approvalUrl = `${baseUrl}/v2/intents/${intentId}`;
  const amount = `${intent.currency} ${(parseInt(intent.amountMinor) / 100).toFixed(2)}`;
  
  // Send email to each approver
  for (const approver of approvers) {
    // Skip if approver is the initiator (maker-checker rule)
    if (approver.id === intent.createdByUserId) {
      continue;
    }
    
    const emailTemplate = generateEmailTemplate("intent_approval_request", {
      name: approver.name || approver.email.split("@")[0],
      amount,
      beneficiary: beneficiary.name,
      purpose: intent.purpose,
      approvalUrl,
      requiredApprovals: requiredApprovals.toString(),
      initiatorName: initiator?.name || "A team member",
    });
    
    const emailOptions = {
      to: approver.email,
      templateType: "intent_approval_request" as const,
      subject: emailTemplate.subject,
      bodyHtml: emailTemplate.bodyHtml,
      bodyText: emailTemplate.bodyText,
      variables: {
        name: approver.name || approver.email.split("@")[0],
        amount,
        beneficiary: beneficiary.name,
        purpose: intent.purpose,
        approvalUrl,
        requiredApprovals: requiredApprovals.toString(),
        initiatorName: initiator?.name || "A team member",
      },
    };
    
    if (process.env.EMAIL_ASYNC === "true") {
      await enqueueEmail({ ...emailOptions, orgId, userId: approver.id });
    } else {
      await sendEmail(emailOptions);
    }
  }
}

/**
 * Send approval completed emails when intent is fully approved
 */
export async function sendApprovalCompletedEmails(params: {
  orgId: string;
  intentId: string;
  intent: {
    id: string;
    amountMinor: string;
    currency: string;
    purpose: string;
    createdByUserId: string;
  };
  beneficiary: {
    name: string;
  };
  approvalEventHash?: string | null;
  poseTxHash?: string | null;
}): Promise<void> {
  const { orgId, intentId, intent, beneficiary, approvalEventHash, poseTxHash } = params;
  
  // Get all approvers who approved
  const approvals = await prisma.approval.findMany({
    where: {
      intentId,
      orgId,
      decisionType: "APPROVE",
      invalidatedAt: null,
    },
    include: {
      approver: {
        select: { id: true, email: true, name: true },
      },
    },
    distinct: ["approverUserId"],
  });
  
  // Get initiator
  const initiator = await prisma.user.findUnique({
    where: { id: intent.createdByUserId },
    select: { name: true, email: true },
  });
  
  const baseUrl = (process.env.FRONTEND_URL || "https://wire.pose.xyz").replace(/\/$/, "");
  const viewUrl = `${baseUrl}/v2/intents/${intentId}`;
  const amount = `${intent.currency} ${(parseInt(intent.amountMinor) / 100).toFixed(2)}`;
  const ledgerLink = getBlockchainExplorerLink(poseTxHash);
  
  // Send email to initiator
  if (initiator) {
    const initiatorTemplate = generateEmailTemplate("intent_executed", {
      name: initiator.name || initiator.email.split("@")[0],
      amount,
      beneficiary: beneficiary.name,
      reference: poseTxHash || approvalEventHash || intentId,
      viewUrl,
    });
    
    // Enhance template with blockchain link if available
    let bodyHtml = initiatorTemplate.bodyHtml;
    if (ledgerLink) {
      bodyHtml = bodyHtml.replace(
        /View Details/i,
        `<a href="${viewUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">View in WIRE</a>
        <p style="margin-top: 12px;">
          <a href="${ledgerLink}" style="color: #000; text-decoration: underline;">View on Blockchain Explorer</a>
        </p>`
      );
    }
    
    const emailOptions = {
      to: initiator.email,
      templateType: "intent_executed" as const,
      subject: `Intent Approved: ${amount}`,
      bodyHtml,
      bodyText: `${initiatorTemplate.bodyText}${ledgerLink ? `\n\nBlockchain: ${ledgerLink}` : ""}`,
      variables: {
        name: initiator.name || initiator.email.split("@")[0],
        amount,
        beneficiary: beneficiary.name,
        reference: poseTxHash || approvalEventHash || intentId,
        viewUrl,
        ledgerLink: ledgerLink || "",
      },
    };
    
    if (process.env.EMAIL_ASYNC === "true") {
      await enqueueEmail({ ...emailOptions, orgId, userId: initiator.id });
    } else {
      await sendEmail(emailOptions);
    }
  }
  
  // Send email to each approver
  for (const approval of approvals) {
    const approver = approval.approver;
    if (!approver) continue;
    
    const approverTemplate = generateEmailTemplate("intent_executed", {
      name: approver.name || approver.email.split("@")[0],
      amount,
      beneficiary: beneficiary.name,
      reference: poseTxHash || approvalEventHash || intentId,
      viewUrl,
    });
    
    // Enhance template with blockchain link if available
    let bodyHtml = approverTemplate.bodyHtml;
    if (ledgerLink) {
      bodyHtml = bodyHtml.replace(
        /View Details/i,
        `<a href="${viewUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">View in WIRE</a>
        <p style="margin-top: 12px;">
          <a href="${ledgerLink}" style="color: #000; text-decoration: underline;">View on Blockchain Explorer</a>
        </p>`
      );
    }
    
    const emailOptions = {
      to: approver.email,
      templateType: "intent_executed" as const,
      subject: `Intent You Approved: ${amount}`,
      bodyHtml,
      bodyText: `${approverTemplate.bodyText}${ledgerLink ? `\n\nBlockchain: ${ledgerLink}` : ""}`,
      variables: {
        name: approver.name || approver.email.split("@")[0],
        amount,
        beneficiary: beneficiary.name,
        reference: poseTxHash || approvalEventHash || intentId,
        viewUrl,
        ledgerLink: ledgerLink || "",
      },
    };
    
    if (process.env.EMAIL_ASYNC === "true") {
      await enqueueEmail({ ...emailOptions, orgId, userId: approver.id });
    } else {
      await sendEmail(emailOptions);
    }
  }
}

/**
 * Send execution completed emails when intent is executed
 */
export async function sendExecutionCompletedEmails(params: {
  orgId: string;
  intentId: string;
  intent: {
    id: string;
    amountMinor: string;
    currency: string;
    purpose: string;
    createdByUserId: string;
  };
  beneficiary: {
    name: string;
  };
  executionRef: string;
  executionEventHash?: string | null;
  poseTxHash?: string | null;
}): Promise<void> {
  const { orgId, intentId, intent, beneficiary, executionRef, executionEventHash, poseTxHash } = params;
  
  // Get all approvers who approved
  const approvals = await prisma.approval.findMany({
    where: {
      intentId,
      orgId,
      decisionType: "APPROVE",
      invalidatedAt: null,
    },
    include: {
      approver: {
        select: { id: true, email: true, name: true },
      },
    },
    distinct: ["approverUserId"],
  });
  
  // Get initiator
  const initiator = await prisma.user.findUnique({
    where: { id: intent.createdByUserId },
    select: { name: true, email: true },
  });
  
  const baseUrl = (process.env.FRONTEND_URL || "https://wire.pose.xyz").replace(/\/$/, "");
  const viewUrl = `${baseUrl}/v2/intents/${intentId}`;
  const amount = `${intent.currency} ${(parseInt(intent.amountMinor) / 100).toFixed(2)}`;
  const ledgerLink = getBlockchainExplorerLink(poseTxHash);
  
  // Send email to initiator
  if (initiator) {
    const initiatorTemplate = generateEmailTemplate("intent_executed", {
      name: initiator.name || initiator.email.split("@")[0],
      amount,
      beneficiary: beneficiary.name,
      reference: executionRef,
      viewUrl,
    });
    
    // Enhance template with blockchain link if available
    let bodyHtml = initiatorTemplate.bodyHtml.replace(/Transfer Executed/, "Transfer Executed");
    if (ledgerLink) {
      bodyHtml = bodyHtml.replace(
        /View Details/i,
        `<a href="${viewUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">View in WIRE</a>
        <p style="margin-top: 12px;">
          <a href="${ledgerLink}" style="color: #000; text-decoration: underline;">View on Blockchain Explorer</a>
        </p>`
      );
    }
    
    const emailOptions = {
      to: initiator.email,
      templateType: "intent_executed" as const,
      subject: `Transfer Executed: ${amount}`,
      bodyHtml,
      bodyText: `${initiatorTemplate.bodyText}${ledgerLink ? `\n\nBlockchain: ${ledgerLink}` : ""}`,
      variables: {
        name: initiator.name || initiator.email.split("@")[0],
        amount,
        beneficiary: beneficiary.name,
        reference: executionRef,
        viewUrl,
        ledgerLink: ledgerLink || "",
      },
    };
    
    if (process.env.EMAIL_ASYNC === "true") {
      await enqueueEmail({ ...emailOptions, orgId, userId: initiator.id });
    } else {
      await sendEmail(emailOptions);
    }
  }
  
  // Send email to each approver
  for (const approval of approvals) {
    const approver = approval.approver;
    if (!approver) continue;
    
    const approverTemplate = generateEmailTemplate("intent_executed", {
      name: approver.name || approver.email.split("@")[0],
      amount,
      beneficiary: beneficiary.name,
      reference: executionRef,
      viewUrl,
    });
    
    // Enhance template with blockchain link if available
    let bodyHtml = approverTemplate.bodyHtml.replace(/Transfer Executed/, "Transfer Executed");
    if (ledgerLink) {
      bodyHtml = bodyHtml.replace(
        /View Details/i,
        `<a href="${viewUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">View in WIRE</a>
        <p style="margin-top: 12px;">
          <a href="${ledgerLink}" style="color: #000; text-decoration: underline;">View on Blockchain Explorer</a>
        </p>`
      );
    }
    
    const emailOptions = {
      to: approver.email,
      templateType: "intent_executed" as const,
      subject: `Transfer Executed: ${amount}`,
      bodyHtml,
      bodyText: `${approverTemplate.bodyText}${ledgerLink ? `\n\nBlockchain: ${ledgerLink}` : ""}`,
      variables: {
        name: approver.name || approver.email.split("@")[0],
        amount,
        beneficiary: beneficiary.name,
        reference: executionRef,
        viewUrl,
        ledgerLink: ledgerLink || "",
      },
    };
    
    if (process.env.EMAIL_ASYNC === "true") {
      await enqueueEmail({ ...emailOptions, orgId, userId: approver.id });
    } else {
      await sendEmail(emailOptions);
    }
  }
}

/**
 * Send password reset confirmation email
 */
export async function sendPasswordResetConfirmation(params: {
  userId: string;
  orgId: string;
  email: string;
  name: string;
}): Promise<void> {
  const { email, name } = params;
  
  const baseUrl = (process.env.FRONTEND_URL || "https://wire.pose.xyz").replace(/\/$/, "");
  const loginUrl = `${baseUrl}/v2/login`;
  
  const emailTemplate = generateEmailTemplate("password_reset", {
    name: name || email.split("@")[0],
    resetUrl: loginUrl, // Reuse template but point to login
    expiresAt: "completed",
  });
  
  // Customize for confirmation
  const subject = "Password Reset Confirmed";
  const bodyHtml = `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
        <div style="background-color: #f8f8f8; padding: 20px; border-radius: 8px;">
          <h1 style="color: #111; font-size: 22px; margin: 0 0 10px;">Password Reset Confirmed</h1>
          <p style="color: #333; margin: 0 0 12px;">Hi ${name || "there"},</p>
          <p style="color: #333; margin: 0 0 12px;">
            Your password has been successfully reset. You can now sign in with your new password.
          </p>
          <p style="text-align: center; margin: 18px 0 22px;">
            <a href="${loginUrl}" style="background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: bold; display: inline-block;">
              Sign In
            </a>
          </p>
          <p style="color: #333; font-size: 12px; margin: 0;">
            If you didn't request this password reset, please contact support immediately.
          </p>
          <p style="color: #777; font-size: 14px; margin-top: 18px;">— The WIRE Security Team</p>
        </div>
      </body>
    </html>
  `;
  const bodyText = `Password Reset Confirmed\n\nHi ${name || "there"},\n\nYour password has been successfully reset. Sign in: ${loginUrl}`;
  
  const emailOptions = {
    to: email,
    templateType: "password_reset" as const,
    subject,
    bodyHtml,
    bodyText,
    variables: {
      name: name || email.split("@")[0],
      resetUrl: loginUrl,
      expiresAt: "completed",
    },
  };
  
  if (process.env.EMAIL_ASYNC === "true") {
    await enqueueEmail({ ...emailOptions, orgId: params.orgId, userId: params.userId });
  } else {
    await sendEmail(emailOptions);
  }
}
