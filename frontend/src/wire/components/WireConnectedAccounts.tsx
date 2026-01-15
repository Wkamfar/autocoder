import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { WireBankConnectionModal } from "./WireBankConnectionModal";
import { WireMicroDepositVerification } from "./WireMicroDepositVerification";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";

interface ConnectedAccount {
  id: string;
  bankName: string;
  accountType: "checking" | "savings";
  accountLast4: string;
  verificationStatus: "verified" | "pending" | "failed";
  connectionMethod: "instant" | "manual";
  connectedAt: string;
}

interface BankConnection {
  id: string;
  name: string;
  type: "primary" | "secondary";
  status: "connected" | "disconnected" | "pending";
  lastSync: string;
  accountCount: number;
  totalBalance?: number;
  currency: string;
}

// Mock data for individual accounts
const MOCK_ACCOUNTS: ConnectedAccount[] = [
  {
    id: "acc_1",
    bankName: "Chase",
    accountType: "checking",
    accountLast4: "1234",
    verificationStatus: "verified",
    connectionMethod: "instant",
    connectedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "acc_2",
    bankName: "Bank of America",
    accountType: "savings",
    accountLast4: "5678",
    verificationStatus: "pending",
    connectionMethod: "manual",
    connectedAt: "2024-01-18T10:00:00Z",
  },
];

// Mock data for bank connections
const MOCK_BANKS: BankConnection[] = [
  {
    id: "bank_1",
    name: "Chase Business Banking",
    type: "primary",
    status: "connected",
    lastSync: "2025-01-20T10:30:00Z",
    accountCount: 3,
    totalBalance: 2500000,
    currency: "USD",
  },
  {
    id: "bank_2",
    name: "Bank of America Treasury",
    type: "secondary",
    status: "connected",
    lastSync: "2025-01-20T09:15:00Z",
    accountCount: 2,
    totalBalance: 1800000,
    currency: "USD",
  },
  {
    id: "bank_3",
    name: "Wells Fargo Operations",
    type: "secondary",
    status: "pending",
    lastSync: "2025-01-19T14:00:00Z",
    accountCount: 1,
    currency: "USD",
  },
];

export function WireConnectedAccounts() {
  const { user, organization } = useAuth();

  // IMPORTANT: Never show mock banking data to real logged-in users.
  // Mock data is only allowed when running in explicit mock API mode.
  const showMockData = useMemo(() => {
    return import.meta.env.VITE_API_MODE === "mock";
  }, []);

  const [accounts] = useState<ConnectedAccount[]>(showMockData ? MOCK_ACCOUNTS : []);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [verifyingAccountId, setVerifyingAccountId] = useState<string | null>(null);

  const { data: banks = [] } = useQuery({
    queryKey: ["banks", organization?.id || "no-org", showMockData ? "mock" : "real"],
    queryFn: () => Promise.resolve(showMockData ? MOCK_BANKS : []),
    enabled: true,
  });

  const handleVerifyMicroDeposits = (amounts: { amount1: string; amount2: string }) => {
    // Mock: In real implementation, verify amounts with backend
    console.log("Verifying amounts:", amounts);
    setVerifyingAccountId(null);
  };

  const formatCurrency = (amount: number | undefined, currency: string = "USD") => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const connectedBanks = banks.filter((b: BankConnection) => b.status === "connected");
  const disconnectedBanks = banks.filter((b: BankConnection) => b.status !== "connected");

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Bank Connections & Accounts</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {organization?.name ? `${organization.name} • ` : ""}
              {showMockData
                ? `Demo data • ${connectedBanks.length} banks • ${accounts.length} account${accounts.length !== 1 ? "s" : ""}`
                : "No connected banks yet"}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setShowAddBank(true)}
              className="px-4 py-3 sm:py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all min-h-[44px] sm:min-h-0"
              disabled={!showMockData}
              title={!showMockData ? "Bank connections are not enabled in this build yet." : undefined}
            >
              + Connect Bank
            </button>
            <button
              onClick={() => setShowConnectionModal(true)}
              className="px-4 py-3 sm:py-2 border-2 border-black text-black text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all min-h-[44px] sm:min-h-0"
              disabled={!showMockData}
              title={!showMockData ? "Bank connections are not enabled in this build yet." : undefined}
            >
              + Connect Account
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-6">
          {!showMockData && connectedBanks.length === 0 && accounts.length === 0 && (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">No connected banks yet</div>
              <div className="text-sm text-gray-600 mt-1">
                This environment is using real authentication, so we don’t show demo banking data.
                Bank connectivity can be enabled once the banking connector backend is wired up.
              </div>
              <div className="text-xs text-gray-500 mt-3">
                In the meantime, you can still run end-to-end transfer workflows using Beneficiaries + Intents.
              </div>
            </div>
          )}

          {/* Connected Banks */}
          {connectedBanks.length > 0 && (
            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Connected Banks</h3>
              {connectedBanks.map((bank) => (
                <motion.div
                  key={bank.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-2 border-black rounded-xl p-4 sm:p-5 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-base sm:text-lg font-bold text-gray-900">{bank.name}</h4>
                          {bank.type === "primary" && (
                            <Badge tone="success" className="text-xs">Primary</Badge>
                          )}
                          <Badge tone="success" className="text-xs">Connected</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {bank.accountCount} account{bank.accountCount !== 1 ? "s" : ""}
                          </span>
                          {bank.totalBalance && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatCurrency(bank.totalBalance, bank.currency)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Synced {formatDate(bank.lastSync)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <button
                        onClick={() => {
                          // Sync bank
                        }}
                        className="px-3 py-2 text-xs font-medium text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
                      >
                        Sync Now
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Disconnected/Pending Banks */}
          {disconnectedBanks.length > 0 && (
            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Pending Connections</h3>
              {disconnectedBanks.map((bank) => (
                <motion.div
                  key={bank.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-2 border-gray-200 rounded-xl p-4 sm:p-5 bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-gray-900">{bank.name}</h4>
                        <p className="text-sm text-gray-600">
                          {bank.status === "pending" ? "Connection pending" : "Disconnected"}
                        </p>
                      </div>
                    </div>
                    <Badge tone="warning" className="text-xs">
                      {bank.status === "pending" ? "Pending" : "Disconnected"}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Individual Accounts */}
          {accounts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Individual Accounts</h3>
              {accounts.map((account) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-2 border-black rounded-xl bg-white p-4 sm:p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      <span className="text-2xl">🏦</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{account.bankName}</h3>
                      <p className="text-sm text-gray-600">
                        {account.accountType === "checking" ? "Checking" : "Savings"} •••• {account.accountLast4}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-4">
                    {account.verificationStatus === "verified" ? (
                      <Badge tone="success">Verified</Badge>
                    ) : account.verificationStatus === "pending" ? (
                      <Badge tone="warning">Pending Verification</Badge>
                    ) : (
                      <Badge tone="danger">Verification Failed</Badge>
                    )}
                    <span className="text-xs text-gray-500">
                      Connected {new Date(account.connectedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {account.verificationStatus === "pending" && account.connectionMethod === "manual" && (
                    <div className="mt-4">
                      <button
                        onClick={() => setVerifyingAccountId(account.id)}
                        className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all"
                      >
                        Verify Micro-Deposits
                      </button>
                    </div>
                  )}
                </div>

                <div className="ml-4">
                  <button className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Benefits Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h3 className="text-base font-bold text-gray-900 mb-4">Multi-Bank Connectivity Benefits</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="font-bold text-gray-900 mb-2">Works Across Banks</h4>
            <p className="text-sm text-gray-600">
              Connect multiple banks and manage transfers from a single interface. Not tied to one institution.
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h4 className="font-bold text-gray-900 mb-2">Unified Security</h4>
            <p className="text-sm text-gray-600">
              Same voice verification and fraud prevention across all connected banks. Consistent security model.
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h4 className="font-bold text-gray-900 mb-2">Centralized Management</h4>
            <p className="text-sm text-gray-600">
              View all bank accounts, balances, and transfer activity in one place. Simplified operations.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Bank Connection Modal */}
      {showConnectionModal && (
        <WireBankConnectionModal
          isOpen={showConnectionModal}
          onClose={() => setShowConnectionModal(false)}
          onSuccess={(accountId) => {
            console.log("Account connected:", accountId);
            setShowConnectionModal(false);
          }}
          accountType="sender"
        />
      )}

      {/* Add Bank Modal */}
      {showAddBank && (
        <AddBankModal
          onClose={() => setShowAddBank(false)}
          onConnect={(bankName: string) => {
            console.log(`Connecting to ${bankName}...`);
            setShowAddBank(false);
          }}
        />
      )}

      {/* Micro-Deposit Verification */}
      {verifyingAccountId && (
        <WireMicroDepositVerification
          accountId={verifyingAccountId}
          onVerify={handleVerifyMicroDeposits}
          onResend={() => console.log("Resending deposits")}
        />
      )}
    </div>
  );
}

function AddBankModal({ onClose, onConnect }: { onClose: () => void; onConnect: (bankName: string) => void }) {
  const [selectedBank, setSelectedBank] = useState<string>("");

  const popularBanks = [
    "Chase",
    "Bank of America",
    "Wells Fargo",
    "Citibank",
    "US Bank",
    "PNC Bank",
    "TD Bank",
    "Capital One",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl border-2 border-black bg-white shadow-2xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <header className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Connect Bank</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Connect your bank account securely using Plaid or similar service. Your credentials are never stored.
          </p>
          <div className="space-y-2 mb-6">
            {popularBanks.map((bank) => (
              <button
                key={bank}
                onClick={() => setSelectedBank(bank)}
                className={`w-full text-left px-4 py-3 border-2 rounded-xl transition-all min-h-[44px] ${
                  selectedBank === bank
                    ? "border-black bg-gray-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{bank}</span>
                  {selectedBank === bank && (
                    <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={() => selectedBank && onConnect(selectedBank)}
              disabled={!selectedBank}
              className="flex-1 px-4 py-3 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[44px]"
            >
              Connect
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
