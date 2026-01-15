import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("axios", () => {
  return {
    default: {
      post: vi.fn(),
    },
  };
});

import axios from "axios";
import { prisma } from "../../../../db/prisma.js";
import { dbAvailable } from "../../../../tests/testDb.js";
import { plaidTransferExecute } from "../transferExecution.js";
import { canonicalJsonStringify } from "../../../../lib/canonicalJson.js";

describe("Plaid Transfer execution connector (mocked)", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    process.env.PLAID_CLIENT_ID = "test_client";
    process.env.PLAID_SECRET = "test_secret";
    process.env.PLAID_ENV = "sandbox";

    if (await dbAvailable()) {
      await prisma.bankAccount.deleteMany({});
      await prisma.bankConnection.deleteMany({});
      // minimal connection + account with plaid_account_id in ownershipJson
      await prisma.bankConnection.create({
        data: {
          id: "bankconn_1",
          orgId: "org_test",
          createdByUserId: "user_test",
          provider: "plaid",
          institutionName: "Sandbox Bank",
          status: "ACTIVE",
          accessTokenEncrypted: "access_token_plain",
          refreshTokenEncrypted: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSyncAt: new Date(),
          lastError: null,
          consentExpiresAt: null,
        },
      });
      await prisma.bankAccount.create({
        data: {
          id: "bankacct_1",
          orgId: "org_test",
          connectionId: "bankconn_1",
          name: "Checking",
          mask: "0000",
          type: "depository",
          currency: "USD",
          railsEligible: ["ACH"],
          ownershipJson: canonicalJsonStringify({ provider: "plaid", plaid_account_id: "acc_plaid_1" }),
          verificationJson: canonicalJsonStringify({ provider: "plaid" }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }
  });

  it("creates recipient → auth → transfer and returns transfer_id", async () => {
    if (!(await dbAvailable())) return;

    (axios as any).post
      .mockResolvedValueOnce({ data: { recipient_id: "recip_1" } })
      .mockResolvedValueOnce({ data: { authorization: { id: "auth_1", decision: "approved" } } })
      .mockResolvedValueOnce({ data: { transfer: { id: "tr_1", status: "pending" }, request_id: "req_1" } });

    const res = await plaidTransferExecute({
      orgId: "org_test",
      executionRef: "exec_1",
      idempotencyKey: "idem_1",
      amountMinor: "12345",
      currency: "USD",
      recipient: { name: "Vendor", routingNumber: "011000015", accountNumber: "123456789" },
    });

    expect(res.transfer_id).toBe("tr_1");
    expect(res.status).toBe("pending");
  });
});

