import React, { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useToast } from "../../crm/ui/CrmDesignSystem";

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

// Mock data - will be replaced with real API
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

export default function WireBanksPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showAddBank, setShowAddBank] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BankConnection | null>(null);

  const { data: banks = MOCK_BANKS, isLoading } = useQuery({
    queryKey: ["banks"],
    queryFn: () => Promise.resolve(MOCK_BANKS),
  });

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

  const connectedBanks = banks.filter((b) => b.status === "connected");
  const disconnectedBanks = banks.filter((b) => b.status !== "connected");

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
            <h2 className="text-base font-bold text-gray-900">Bank Connections</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Multi-bank connectivity • {connectedBanks.length} connected • {banks.length} total
            </p>
          </div>
          <button
            onClick={() => setShowAddBank(true)}
            className="px-4 py-3 sm:py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all min-h-[44px] sm:min-h-0"
          >
            + Connect Bank
          </button>
        </header>

        <div className="p-4 sm:p-6">
          {/* Connected Banks */}
          {connectedBanks.length > 0 && (
            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Connected Banks</h3>
              {connectedBanks.map((bank) => (
                <motion.div
                  key={bank.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-2 border-black rounded-xl p-4 sm:p-5 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedBank(bank)}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          // Sync bank
                        }}
                        className="px-3 py-2 text-xs font-medium text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
                      >
                        Sync Now
                      </button>
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Disconnected/Pending Banks */}
          {disconnectedBanks.length > 0 && (
            <div className="space-y-3">
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

          {/* Empty State */}
          {banks.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <p className="text-sm font-medium text-gray-900 mb-2">No banks connected</p>
              <p className="text-xs text-gray-600 mb-4">Connect your first bank to start using WIRE</p>
              <button
                onClick={() => setShowAddBank(true)}
                className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800"
              >
                Connect Bank
              </button>
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3l7 4v6c0 5-3 9-7 11-4-2-7-6-7-11V7l7-4z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.5 12.5l1.8 1.8L14.8 10.6"
                />
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

      {/* Add Bank Modal */}
      {showAddBank && (
        <AddBankModal
          onClose={() => setShowAddBank(false)}
          onConnect={(bankName: string) => {
            toast.push({
              tone: "success",
              message: `Connecting to ${bankName}...`,
            });
            setShowAddBank(false);
          }}
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
                className={`w-full text-left px-4 py-3 border-2 rounded-xl transition-all ${
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
