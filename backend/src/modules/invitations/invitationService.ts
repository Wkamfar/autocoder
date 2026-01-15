/**
 * User Invitation Service
 * 
 * Handles user invitations, email sending, and acceptance
 */

import { prisma } from "../../db/prisma.js";
import { sha256Hex } from "../../lib/sha256.js";
import crypto from "crypto";
import { sendEmail, generateEmailTemplate } from "../email/emailService.js";
import { enqueueEmail } from "../email/emailJobs.js";

export interface UserInvitation {
  id: string;
  orgId: string;
  invitedByUserId: string;
  email: string;
  role: string;
  permissions: string[];
  tokenHash: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * Create a user invitation
 */
export async function createInvitation(params: {
  orgId: string;
  invitedByUserId: string;
  email: string;
  role: "ADMIN" | "TREASURY_INITIATOR" | "APPROVER" | "EXECUTOR" | "AUDITOR" | "READ_ONLY" | "VIEWER";
  permissions?: string[];
  expiresInDays?: number;
}): Promise<{ invitation: UserInvitation; inviteUrl: string }> {
  // Check if user already exists (email is not unique, use findFirst)
  const existingUser = await prisma.user.findFirst({
    where: { email: params.email },
  });
  
  if (existingUser) {
    throw new Error("User with this email already exists");
  }
  
  // Check if invitation already exists and is pending
  const existingInvitation = await prisma.userInvitation.findFirst({
    where: {
      email: params.email,
      orgId: params.orgId,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  
  if (existingInvitation) {
    throw new Error("Pending invitation already exists for this email");
  }
  
  // Generate invitation token
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);
  
  const expiresInDays = params.expiresInDays || 7;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  
  // Default permissions based on role
  const defaultPermissions: Record<string, string[]> = {
    ADMIN: [
      "intent:create",
      "intent:approve",
      "intent:execute",
      "intent:view_events",
      "intent:view_bundle",
      "beneficiary:create",
      "beneficiary:lock",
      "policy:edit",
      "user:create",
      "user:view",
      "user:edit",
      "evidence:view",
      "evidence:export_full",
      "audit:read",
    ],
    TREASURY_INITIATOR: [
      "intent:create",
      "intent:approve",
      "beneficiary:create",
      "intent:view_events",
      "intent:view_bundle",
      "evidence:view",
    ],
    APPROVER: [
      "intent:approve",
      "intent:view_events",
      "intent:view_bundle",
      "evidence:view",
    ],
    EXECUTOR: [
      "intent:execute",
      "intent:view_events",
      "intent:view_bundle",
      "evidence:view",
    ],
    AUDITOR: [
      "intent:view_events",
      "intent:view_bundle",
      "audit:read",
      "evidence:view",
      "evidence:export_full",
    ],
    READ_ONLY: [
      "intent:view_events",
      "intent:view_bundle",
      "evidence:view",
    ],
    VIEWER: [
      "intent:view_events",
      "intent:view_bundle",
      "evidence:view",
    ],
  };
  
  const permissions = params.permissions || defaultPermissions[params.role] || [];
  
  const invitation = await prisma.userInvitation.create({
    data: {
      id: `invite_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
      orgId: params.orgId,
      invitedByUserId: params.invitedByUserId,
      email: params.email,
      role: params.role,
      permissions,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
    },
  });
  
  // Get organization and inviter info for email
  const org = await prisma.organization.findUnique({
    where: { id: params.orgId },
  });
  
  const inviter = await prisma.user.findUnique({
    where: { id: params.invitedByUserId },
  });
  
  // Generate invite URL
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3001";
  // Frontend uses BrowserRouter basename="/v2", so deep links must include /v2
  const inviteUrl = `${baseUrl.replace(/\/$/, "")}/v2/invite/${token}`;
  
  // Send invitation email
  const emailTemplate = generateEmailTemplate("user_invitation", {
    orgName: org?.name || "WIRE",
    inviterName: inviter?.name || "A team member",
    role: params.role,
    acceptUrl: inviteUrl,
    expiresAt: expiresAt.toLocaleDateString(),
  });
  
  const emailOptions = {
    to: params.email,
    templateType: "user_invitation" as const,
    subject: emailTemplate.subject,
    bodyHtml: emailTemplate.bodyHtml,
    bodyText: emailTemplate.bodyText,
    variables: {
      orgName: org?.name || "WIRE",
      inviterName: inviter?.name || "A team member",
      role: params.role,
      acceptUrl: inviteUrl,
      expiresAt: expiresAt.toLocaleDateString(),
    },
  };

  if (process.env.EMAIL_ASYNC === "true") {
    await enqueueEmail({ ...emailOptions, orgId: params.orgId, userId: params.invitedByUserId });
  } else {
    await sendEmail(emailOptions);
  }
  
  return {
    invitation: {
      id: invitation.id,
      orgId: invitation.orgId,
      invitedByUserId: invitation.invitedByUserId,
      email: invitation.email,
      role: invitation.role as any,
      permissions: invitation.permissions,
      tokenHash: invitation.tokenHash,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      acceptedByUserId: invitation.acceptedByUserId,
      revokedAt: invitation.revokedAt,
      createdAt: invitation.createdAt,
    },
    inviteUrl,
  };
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(params: {
  token: string;
  name: string;
  password?: string; // Optional for demo mode
}): Promise<{ userId: string; orgId: string; invitationId: string; email: string; role: string }> {
  const tokenHash = sha256Hex(params.token);
  
  const invitation = await prisma.userInvitation.findUnique({
    where: { tokenHash },
  });
  
  if (!invitation) {
    throw new Error("Invalid invitation token");
  }
  
  if (invitation.revokedAt) {
    throw new Error("Invitation has been revoked");
  }
  
  if (invitation.acceptedAt) {
    throw new Error("Invitation has already been accepted");
  }
  
  if (invitation.expiresAt.getTime() < Date.now()) {
    throw new Error("Invitation has expired");
  }
  
  // Check if user already exists (email is not unique, use findFirst)
  const existingUser = await prisma.user.findFirst({
    where: { email: invitation.email },
  });
  
  if (existingUser) {
    throw new Error("User with this email already exists");
  }
  
  // Create user
  const userId = `user_${invitation.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;
  
  const user = await prisma.user.create({
    data: {
      id: userId,
      orgId: invitation.orgId,
      email: invitation.email,
      name: params.name,
      role: invitation.role as any,
      permissions: invitation.permissions,
      voiceEnrolled: false,
      createdAt: new Date(),
    },
  });
  
  // Mark invitation as accepted
  await prisma.userInvitation.update({
    where: { id: invitation.id },
    data: {
      acceptedAt: new Date(),
      acceptedByUserId: userId,
    },
  });
  
  return {
    userId: user.id,
    orgId: user.orgId,
    invitationId: invitation.id,
    email: invitation.email,
    role: invitation.role,
  };
}

/**
 * List invitations for an organization
 */
export async function listInvitations(orgId: string): Promise<UserInvitation[]> {
  const invitations = await prisma.userInvitation.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  
  return invitations.map((inv) => ({
    id: inv.id,
    orgId: inv.orgId,
    invitedByUserId: inv.invitedByUserId,
    email: inv.email,
    role: inv.role as any,
    permissions: inv.permissions,
    tokenHash: inv.tokenHash,
    expiresAt: inv.expiresAt,
    acceptedAt: inv.acceptedAt,
    acceptedByUserId: inv.acceptedByUserId,
    revokedAt: inv.revokedAt,
    createdAt: inv.createdAt,
  }));
}

/**
 * Revoke an invitation
 */
export async function revokeInvitation(
  orgId: string,
  invitationId: string
): Promise<boolean> {
  const invitation = await prisma.userInvitation.findFirst({
    where: { id: invitationId, orgId },
  });
  if (!invitation) {
    return false;
  }
  
  if (invitation.acceptedAt) {
    return false; // Can't revoke accepted invitations
  }
  
  await prisma.userInvitation.update({
    where: { id: invitationId },
    data: { revokedAt: new Date() },
  });
  
  return true;
}

/**
 * Get invitation by token
 */
export async function getInvitationByToken(
  token: string
): Promise<UserInvitation | null> {
  const tokenHash = sha256Hex(token);
  
  const invitation = await prisma.userInvitation.findUnique({
    where: { tokenHash },
  });
  
  if (!invitation) {
    return null;
  }
  
  return {
    id: invitation.id,
    orgId: invitation.orgId,
    invitedByUserId: invitation.invitedByUserId,
    email: invitation.email,
    role: invitation.role as any,
    permissions: invitation.permissions,
    tokenHash: invitation.tokenHash,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    acceptedByUserId: invitation.acceptedByUserId,
    revokedAt: invitation.revokedAt,
    createdAt: invitation.createdAt,
  };
}
