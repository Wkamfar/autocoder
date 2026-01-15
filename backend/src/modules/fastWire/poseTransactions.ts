/**
 * POSE Network Transaction Functions for Fast Wire
 * 
 * Creates POSE network transactions for:
 * 1. Initiate Intent (requestor creates Fast Wire)
 * 2. Receive/Approve (approver approves)
 * 3. Final Approval (links both accounts in one TX)
 */

import axios from "axios";
import { logger } from "../../lib/observability.js";

const POSE_CORE_API_URL = process.env.POSE_CORE_API_URL || "https://api.testnet.pose.xyz";

export interface InitiateIntentParams {
  requestorEmail: string;
  requestorName: string;
  amountMinor: string;
  currency: string;
  purpose: string;
  beneficiaryEmail: string;
  requestorPoseId?: string; // POSE ID for requestor (if they have one)
}

export interface ReceiveApproveParams {
  approverEmail: string;
  approverName: string;
  requestorTxHash: string;
  approverPoseId?: string; // POSE ID for approver (if they have one)
}

export interface FinalApprovalParams {
  requestorTxHash: string;
  approverTxHash: string;
  requestorEmail: string;
  approverEmail: string;
}

/**
 * Initiate Intent - Create POSE network transaction when requestor creates Fast Wire
 */
export async function initiatePoseIntent(params: InitiateIntentParams): Promise<{
  txHash: string;
  poseId?: string;
}> {
  try {
    // Call POSE Core API to initiate intent
    // This creates a transaction on the POSE network representing the intent to transfer
    const response = await axios.post(
      `${POSE_CORE_API_URL}/api/pose/intent/initiate`,
      {
        requestorEmail: params.requestorEmail,
        requestorName: params.requestorName,
        amountMinor: params.amountMinor,
        currency: params.currency,
        purpose: params.purpose,
        beneficiaryEmail: params.beneficiaryEmail,
        requestorPoseId: params.requestorPoseId,
        type: "fast_wire",
      },
      {
        timeout: 30_000,
        validateStatus: (status) => status >= 200 && status < 500,
      }
    );

    if (response.status >= 200 && response.status < 300) {
      const txHash = response.data?.txHash || response.data?.hash;
      const poseId = response.data?.poseId;
      
      if (!txHash) {
        throw new Error("POSE Core did not return transaction hash");
      }

      logger.info("POSE intent initiated", {
        requestorEmail: params.requestorEmail,
        beneficiaryEmail: params.beneficiaryEmail,
        txHash,
        poseId,
      });

      return { txHash: String(txHash), poseId };
    }

    throw new Error(`POSE Core API error: ${response.status} - ${JSON.stringify(response.data).slice(0, 200)}`);
  } catch (error: any) {
    // If POSE Core API is not available, generate a mock TX hash for development
    if (process.env.NODE_ENV === "development" || !process.env.POSE_CORE_API_URL) {
      logger.warn("POSE Core API not available, using mock transaction hash", {
        error: error.message,
      });
      const mockTxHash = `0x${Buffer.from(`${params.requestorEmail}:${Date.now()}`).toString("hex").slice(0, 64)}`;
      return { txHash: mockTxHash };
    }
    
    throw new Error(`Failed to initiate POSE intent: ${error.message}`);
  }
}

/**
 * Receive/Approve - Create POSE network transaction when approver approves Fast Wire
 * Links to the requestor's transaction
 */
export async function receiveApprovePoseIntent(params: ReceiveApproveParams): Promise<{
  txHash: string;
  poseId?: string;
}> {
  try {
    // Call POSE Core API to receive/approve intent
    // This creates a transaction linking to the requestor's intent
    const response = await axios.post(
      `${POSE_CORE_API_URL}/api/pose/intent/receive`,
      {
        approverEmail: params.approverEmail,
        approverName: params.approverName,
        requestorTxHash: params.requestorTxHash,
        approverPoseId: params.approverPoseId,
        type: "fast_wire",
      },
      {
        timeout: 30_000,
        validateStatus: (status) => status >= 200 && status < 500,
      }
    );

    if (response.status >= 200 && response.status < 300) {
      const txHash = response.data?.txHash || response.data?.hash;
      const poseId = response.data?.poseId;
      
      if (!txHash) {
        throw new Error("POSE Core did not return transaction hash");
      }

      logger.info("POSE intent received/approved", {
        approverEmail: params.approverEmail,
        requestorTxHash: params.requestorTxHash,
        txHash,
        poseId,
      });

      return { txHash: String(txHash), poseId };
    }

    throw new Error(`POSE Core API error: ${response.status} - ${JSON.stringify(response.data).slice(0, 200)}`);
  } catch (error: any) {
    // If POSE Core API is not available, generate a mock TX hash for development
    if (process.env.NODE_ENV === "development" || !process.env.POSE_CORE_API_URL) {
      logger.warn("POSE Core API not available, using mock transaction hash", {
        error: error.message,
      });
      const mockTxHash = `0x${Buffer.from(`${params.approverEmail}:${params.requestorTxHash}:${Date.now()}`).toString("hex").slice(0, 64)}`;
      return { txHash: mockTxHash };
    }
    
    throw new Error(`Failed to receive/approve POSE intent: ${error.message}`);
  }
}

/**
 * Final Approval - Create POSE network transaction linking both accounts
 * This shows both accounts approved in one transaction, even if made from different TXs
 */
export async function createFinalApprovalPoseTx(params: FinalApprovalParams): Promise<{
  txHash: string;
  linkedTxHashes: string[];
}> {
  try {
    // Call POSE Core API to create final approval transaction
    // This links both the requestor and approver transactions into one final TX
    const response = await axios.post(
      `${POSE_CORE_API_URL}/api/pose/intent/final-approval`,
      {
        requestorTxHash: params.requestorTxHash,
        approverTxHash: params.approverTxHash,
        requestorEmail: params.requestorEmail,
        approverEmail: params.approverEmail,
        type: "fast_wire",
      },
      {
        timeout: 30_000,
        validateStatus: (status) => status >= 200 && status < 500,
      }
    );

    if (response.status >= 200 && response.status < 300) {
      const txHash = response.data?.txHash || response.data?.hash;
      const linkedTxHashes = response.data?.linkedTxHashes || [params.requestorTxHash, params.approverTxHash];
      
      if (!txHash) {
        throw new Error("POSE Core did not return transaction hash");
      }

      logger.info("POSE final approval transaction created", {
        requestorEmail: params.requestorEmail,
        approverEmail: params.approverEmail,
        txHash,
        linkedTxHashes,
      });

      return { txHash: String(txHash), linkedTxHashes };
    }

    throw new Error(`POSE Core API error: ${response.status} - ${JSON.stringify(response.data).slice(0, 200)}`);
  } catch (error: any) {
    // If POSE Core API is not available, generate a mock TX hash for development
    if (process.env.NODE_ENV === "development" || !process.env.POSE_CORE_API_URL) {
      logger.warn("POSE Core API not available, using mock transaction hash", {
        error: error.message,
      });
      const mockTxHash = `0x${Buffer.from(`final:${params.requestorTxHash}:${params.approverTxHash}:${Date.now()}`).toString("hex").slice(0, 64)}`;
      return { 
        txHash: mockTxHash,
        linkedTxHashes: [params.requestorTxHash, params.approverTxHash],
      };
    }
    
    throw new Error(`Failed to create final approval POSE transaction: ${error.message}`);
  }
}
