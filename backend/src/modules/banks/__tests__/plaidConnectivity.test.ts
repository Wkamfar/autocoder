import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("axios", () => {
  return {
    default: {
      post: vi.fn(),
    },
  };
});

import axios from "axios";

import { createPlaidLinkToken, exchangePlaidPublicToken } from "../plaidConnectivity.js";
import { prisma } from "../../../db/prisma.js";
import { dbAvailable } from "../../../tests/testDb.js";

describe("Plaid connectivity (Link/Auth/Identity) - unit-ish with mocked Plaid API", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    process.env.PLAID_CLIENT_ID = "test_client";
    process.env.PLAID_SECRET = "test_secret";
    process.env.PLAID_ENV = "sandbox";
    // encryption key optional in tests
    delete process.env.WIRE2_SECRETS_ENCRYPTION_KEY;

    if (await dbAvailable()) {
      // Keep test isolated
      await prisma.bankAccount.deleteMany({});
      await prisma.bankConnection.deleteMany({});
    }
  });

  it("creates a link token", async () => {
    (axios as any).post.mockResolvedValueOnce({
      data: { link_token: "link-sandbox-123", expiration: new Date().toISOString(), request_id: "req_1" },
    });
    const res = await createPlaidLinkToken({ orgId: "org_test", userId: "user_test", clientUserId: "client_user_1" });
    expect(res.link_token).toContain("link");
  });

  it("exchanges a public token and stores a bank connection + accounts", async () => {
    if (!(await dbAvailable())) return;

    // Exchange
    (axios as any).post
      .mockResolvedValueOnce({ data: { access_token: "access-sandbox-1", item_id: "item_1", request_id: "req_x" } }) // /item/public_token/exchange
      .mockResolvedValueOnce({ data: { item: { institution_id: "ins_1" } } }) // /item/get
      .mockResolvedValueOnce({ data: { institution: { name: "Sandbox Bank" } } }) // /institutions/get_by_id
      .mockResolvedValueOnce({ data: { accounts: [{ account_id: "acc_1", name: "Checking", type: "depository", mask: "0000", balances: { iso_currency_code: "USD" } }] } }) // /accounts/get
      .mockResolvedValueOnce({ data: { numbers: {} } }) // /auth/get
      .mockResolvedValueOnce({ data: { accounts: [] } }); // /identity/get

    const res = await exchangePlaidPublicToken({ orgId: "org_test", userId: "user_test", publicToken: "public-sandbox-1" });
    expect(res.connection.provider).toBe("plaid");
    expect(res.connection.institutionName).toBe("Sandbox Bank");
    expect(res.accounts.length).toBe(1);

    const inDb = await prisma.bankConnection.findFirst({ where: { orgId: "org_test" } });
    expect(inDb?.provider).toBe("plaid");
    const acct = await prisma.bankAccount.findFirst({ where: { orgId: "org_test", connectionId: inDb!.id } });
    expect(acct?.name).toBe("Checking");
  });
});

