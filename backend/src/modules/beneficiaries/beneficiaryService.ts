import { prisma } from "../../db/prisma.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";

export async function listBeneficiaries(orgId: string) {
  return await prisma.beneficiary.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createBeneficiary(params: {
  orgId: string;
  userId: string;
  displayName: string;
  country: string;
  railsAllowed: ("ACH" | "WIRE")[];
  bankLast4: string;
  bankTokenHash: string;
}) {
  const now = new Date();
  const id = `benef_${Date.now()}`;

  const beneficiary = await prisma.beneficiary.create({
    data: {
      id,
      orgId: params.orgId,
      displayName: params.displayName,
      country: params.country,
      railsAllowed: params.railsAllowed,
      bankLast4: params.bankLast4,
      bankTokenHash: params.bankTokenHash,
      version: 1,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      lastChangedAt: now,
      lastChangedBy: params.userId,
    },
  });

  await prisma.beneficiaryVersion.create({
    data: {
      id: `${id}_v1`,
      beneficiaryId: id,
      orgId: params.orgId,
      version: 1,
      snapshotJson: canonicalJsonStringify({
        id,
        orgId: params.orgId,
        displayName: params.displayName,
        country: params.country,
        railsAllowed: params.railsAllowed,
        bankLast4: params.bankLast4,
        bankTokenHash: params.bankTokenHash,
        version: 1,
        status: "ACTIVE",
      }),
      createdBy: params.userId,
      createdAt: now,
    },
  });

  return beneficiary;
}

export async function updateBeneficiary(params: {
  orgId: string;
  userId: string;
  beneficiaryId: string;
  patch: Partial<{
    displayName: string;
    country: string;
    railsAllowed: ("ACH" | "WIRE")[];
    bankLast4: string;
    bankTokenHash: string;
    status: "ACTIVE" | "LOCKED" | "PENDING_VERIFICATION";
  }>;
}) {
  const current = await prisma.beneficiary.findFirst({
    where: { id: params.beneficiaryId, orgId: params.orgId },
  });
  if (!current) return null;

  const nextVersion = current.version + 1;
  const now = new Date();

  const updated = await prisma.beneficiary.update({
    where: { id: current.id },
    data: {
      displayName: params.patch.displayName ?? current.displayName,
      country: params.patch.country ?? current.country,
      railsAllowed: params.patch.railsAllowed ?? current.railsAllowed,
      bankLast4: params.patch.bankLast4 ?? current.bankLast4,
      bankTokenHash: params.patch.bankTokenHash ?? current.bankTokenHash,
      status: params.patch.status ?? current.status,
      version: nextVersion,
      updatedAt: now,
      lastChangedAt: now,
      lastChangedBy: params.userId,
    },
  });

  await prisma.beneficiaryVersion.create({
    data: {
      id: `${updated.id}_v${nextVersion}`,
      beneficiaryId: updated.id,
      orgId: updated.orgId,
      version: nextVersion,
      snapshotJson: canonicalJsonStringify({
        id: updated.id,
        orgId: updated.orgId,
        displayName: updated.displayName,
        country: updated.country,
        railsAllowed: updated.railsAllowed,
        bankLast4: updated.bankLast4,
        bankTokenHash: updated.bankTokenHash,
        version: updated.version,
        status: updated.status,
      }),
      createdBy: params.userId,
      createdAt: now,
    },
  });

  return updated;
}

