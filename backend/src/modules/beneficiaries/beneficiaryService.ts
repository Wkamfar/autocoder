import { prisma } from "../../db/prisma.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";
import crypto from "crypto";

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
  email?: string;
  country: string;
  railsAllowed: ("ACH" | "WIRE")[];
  bankLast4: string;
  bankTokenHash: string;
}) {
  const now = new Date();
  const id = `benef_${Date.now()}`;
  
  // Generate confirmation token if email is provided
  const confirmationToken = params.email
    ? crypto.randomBytes(32).toString("base64url")
    : null;
  const confirmationTokenExpiresAt = params.email
    ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
    : null;
  
  // Set status to PENDING_VERIFICATION if email is provided, otherwise ACTIVE
  const status = params.email ? "PENDING_VERIFICATION" : "ACTIVE";

  const beneficiary = await prisma.beneficiary.create({
    data: {
      id,
      orgId: params.orgId,
      displayName: params.displayName,
      email: params.email || null,
      country: params.country,
      railsAllowed: params.railsAllowed,
      bankLast4: params.bankLast4,
      bankTokenHash: params.bankTokenHash,
      version: 1,
      status,
      confirmationToken,
      confirmationTokenExpiresAt,
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
        email: params.email,
        country: params.country,
        railsAllowed: params.railsAllowed,
        bankLast4: params.bankLast4,
        bankTokenHash: params.bankTokenHash,
        version: 1,
        status,
      }),
      createdBy: params.userId,
      createdAt: now,
    },
  });

  return { beneficiary, confirmationToken };
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

/**
 * Calculate beneficiary intelligence from actual intents
 */
export async function getBeneficiaryIntelligence(params: {
  orgId: string;
  beneficiaryId: string;
}) {
  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: params.beneficiaryId, orgId: params.orgId },
  });

  if (!beneficiary) {
    return null;
  }

  // Get all executed intents for this beneficiary
  const intents = await prisma.intent.findMany({
    where: {
      orgId: params.orgId,
      beneficiaryId: params.beneficiaryId,
      status: "EXECUTED",
    },
    orderBy: { createdAt: "asc" },
    include: {
      events: {
        orderBy: { createdAt: "asc" },
      },
      decisions: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const now = new Date();
  const firstIntent = intents[0];
  const relationshipDuration = firstIntent
    ? Math.floor((now.getTime() - firstIntent.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Calculate metrics from actual intents
  const totalTransfers = intents.length;
  const totalVolume = intents.reduce((sum, intent) => {
    return sum + BigInt(intent.amountMinor);
  }, 0n);
  const totalVolumeNumber = Number(totalVolume);
  
  const averageTransferAmount = totalTransfers > 0
    ? totalVolumeNumber / totalTransfers
    : 0;
  
  const largestTransfer = intents.length > 0
    ? Math.max(...intents.map(i => Number(i.amountMinor)))
    : 0;

  // Calculate transfer frequency (transfers per month)
  const transferFrequency = relationshipDuration > 0
    ? (totalTransfers / relationshipDuration) * 30
    : 0;

  // Calculate on-time payment rate (for now, assume all executed intents are on-time)
  // In the future, this could compare scheduled vs actual execution dates
  const onTimePaymentRate = totalTransfers > 0 ? 100 : 0;

  // Calculate dispute rate (count of DENIED intents vs total)
  const deniedIntents = await prisma.intent.count({
    where: {
      orgId: params.orgId,
      beneficiaryId: params.beneficiaryId,
      status: "DENIED",
    },
  });
  const totalIntents = totalTransfers + deniedIntents;
  const disputeRate = totalIntents > 0 ? (deniedIntents / totalIntents) * 100 : 0;

  // Calculate average risk score
  const riskScores = intents.map(i => i.riskScore);
  const avgRiskScore = riskScores.length > 0
    ? riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length
    : 0;

  // Calculate communication score (based on approval times - faster = better)
  const approvalTimes = intents
    .map(intent => {
      const created = intent.createdAt;
      const approved = intent.events.find(e => e.eventType === "APPROVED")?.createdAt;
      if (!approved) return null;
      return (approved.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
    })
    .filter((t): t is number => t !== null);
  
  const avgApprovalTime = approvalTimes.length > 0
    ? approvalTimes.reduce((sum, t) => sum + t, 0) / approvalTimes.length
    : 0;
  
  // Communication score: faster approvals = higher score (max 100)
  const communicationScore = avgApprovalTime > 0
    ? Math.max(0, Math.min(100, 100 - (avgApprovalTime / 24) * 20)) // 24 hours = 80, 0 hours = 100
    : 85; // Default if no approvals yet

  // Trust score: combination of on-time rate, low dispute rate, and low risk
  const trustScore = Math.max(0, Math.min(100,
    (onTimePaymentRate * 0.4) +
    ((100 - disputeRate) * 0.3) +
    ((100 - avgRiskScore) * 0.3)
  ));

  // Calculate seasonal patterns (group by month)
  const monthlyVolumes: Record<string, number> = {};
  intents.forEach(intent => {
    const month = intent.createdAt.toISOString().slice(0, 7); // YYYY-MM
    monthlyVolumes[month] = (monthlyVolumes[month] || 0) + Number(intent.amountMinor);
  });

  const seasonalPatterns = Object.entries(monthlyVolumes)
    .map(([month, volume]) => ({
      month: new Date(month + "-01").toLocaleString("default", { month: "short" }),
      volume,
    }))
    .sort((a, b) => {
      // Sort by month order
      const monthOrder: Record<string, number> = {
        Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
        Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
      };
      return monthOrder[a.month] - monthOrder[b.month];
    });

  // Calculate amount patterns
  const amountRanges = {
    "0-50000": 0,
    "50000-200000": 0,
    "200000-500000": 0,
    "500000+": 0,
  };
  
  intents.forEach(intent => {
    const amount = Number(intent.amountMinor);
    if (amount < 50000) amountRanges["0-50000"]++;
    else if (amount < 200000) amountRanges["50000-200000"]++;
    else if (amount < 500000) amountRanges["200000-500000"]++;
    else amountRanges["500000+"]++;
  });

  const amountPatterns = Object.entries(amountRanges).map(([range, count]) => ({
    range: `$${range.replace("-", "-$")}`,
    count,
  }));

  // Calculate preferred transfer days
  const dayCounts: Record<string, number> = {};
  intents.forEach(intent => {
    const day = intent.createdAt.toLocaleString("default", { weekday: "long" });
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });
  const preferredTransferDays = Object.entries(dayCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day]) => day);

  // Calculate preferred transfer times
  const timeCounts: Record<string, number> = {};
  intents.forEach(intent => {
    const hour = intent.createdAt.getHours();
    const timeSlot = `${hour.toString().padStart(2, "0")}:00`;
    timeCounts[timeSlot] = (timeCounts[timeSlot] || 0) + 1;
  });
  const preferredTransferTimes = Object.entries(timeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([time]) => time);

  // Calculate approval patterns
  const approvalTimesMinutes = approvalTimes.map(t => t * 60);
  const averageApprovalTime = approvalTimesMinutes.length > 0
    ? approvalTimesMinutes.reduce((sum, t) => sum + t, 0) / approvalTimesMinutes.length
    : 0;
  
  const approvedCount = intents.filter(i => 
    i.events.some(e => e.eventType === "APPROVED")
  ).length;
  const approvalRate = totalIntents > 0 ? (approvedCount / totalIntents) * 100 : 0;

  // Risk trend (last 6 months)
  const riskTrend: Array<{ date: string; score: number }> = [];
  const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
  
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getTime() - i * 30 * 24 * 60 * 60 * 1000);
    const monthEnd = new Date(monthStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const monthIntents = intents.filter(i => 
      i.createdAt >= monthStart && i.createdAt < monthEnd
    );
    
    const monthAvgRisk = monthIntents.length > 0
      ? monthIntents.reduce((sum, i) => sum + i.riskScore, 0) / monthIntents.length
      : avgRiskScore; // Use overall average if no intents in this month
    
    riskTrend.push({
      date: monthStart.toISOString().slice(0, 7), // YYYY-MM
      score: Math.round(monthAvgRisk),
    });
  }

  return {
    relationshipMetrics: {
      totalTransfers,
      totalVolume: totalVolumeNumber,
      averageTransferAmount: Math.round(averageTransferAmount),
      largestTransfer,
      relationshipDuration,
      transferFrequency: Math.round(transferFrequency * 10) / 10,
      onTimePaymentRate: Math.round(onTimePaymentRate * 10) / 10,
      disputeRate: Math.round(disputeRate * 10) / 10,
      communicationScore: Math.round(communicationScore),
      trustScore: Math.round(trustScore),
    },
    behavioralPatterns: {
      preferredTransferDays,
      preferredTransferTimes,
      seasonalPatterns,
      amountPatterns,
      approvalPatterns: {
        averageApprovalTime: Math.round(averageApprovalTime),
        approvalRate: Math.round(approvalRate * 10) / 10,
        denialReasons: [], // Could be populated from decision reasons
      },
    },
    riskAnalysis: {
      currentRiskScore: Math.round(avgRiskScore),
      riskTrend,
      riskFactors: [], // Could be populated from risk rationale
      anomalyDetections: [], // Could be populated from fraud detection
    },
    // For now, return empty arrays for fields that need more complex logic
    predictiveAnalytics: {
      nextTransferPrediction: {
        predictedDate: "",
        confidence: 0,
        predictedAmount: 0,
      },
      volumeForecast: [],
      riskForecast: [],
    },
    adminControls: {
      caps: {},
      restrictions: [],
      notes: [],
      tags: [],
      flags: [],
    },
    communicationHistory: [],
    documents: [],
    compliance: {
      kycStatus: beneficiary.status === "ACTIVE" ? "verified" : "pending",
      kycExpiry: "",
      sanctionsCheck: "clear",
      lastSanctionsCheck: "",
      regulatoryFlags: [],
      certifications: [],
    },
    auditTrail: intents.slice(-20).map(intent => ({
      id: intent.id,
      action: "transfer_executed",
      actor: intent.createdByUserId,
      timestamp: intent.createdAt.toISOString(),
      details: {
        amount: intent.amountMinor,
        currency: intent.currency,
        status: intent.status,
      },
    })),
  };
}
