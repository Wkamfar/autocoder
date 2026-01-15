import React, { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { WireModal } from "../ui/WireModal";

type ConnectionMethod = "instant" | "manual";
type ConnectionStep = "method" | "instant" | "manual" | "verifying" | "success";

interface WireBankConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (accountId: string) => void;
  accountType: "sender" | "receiver";
}

export function WireBankConnectionModal({
  isOpen,
  onClose,
  onSuccess,
  accountType,
}: WireBankConnectionModalProps) {
  const [step, setStep] = useState<ConnectionStep>("method");
  const [method, setMethod] = useState<ConnectionMethod | null>(null);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const popularBanks = [
    { id: "chase", name: "Chase", logo: "🏦" },
    { id: "bankofamerica", name: "Bank of America", logo: "🏦" },
    { id: "wells-fargo", name: "Wells Fargo", logo: "🏦" },
    { id: "citibank", name: "Citi", logo: "🏦" },
    { id: "us-bank", name: "U.S. Bank", logo: "🏦" },
  ];

  const handleMethodSelect = (selectedMethod: ConnectionMethod) => {
    setMethod(selectedMethod);
    if (selectedMethod === "instant") {
      setStep("instant");
    } else {
      setStep("manual");
    }
  };

  const handleInstantConnect = async (bankId: string) => {
    setSelectedBank(bankId);
    setIsVerifying(true);
    setStep("verifying");
    
    // Mock: In real implementation, this would open Plaid Link or similar
    setTimeout(() => {
      setIsVerifying(false);
      setStep("success");
      setTimeout(() => {
        onSuccess("acc_" + Math.random().toString(36).substr(2, 9));
        onClose();
        setStep("method");
        setMethod(null);
      }, 2000);
    }, 3000);
  };

  const handleManualSubmit = async (data: any) => {
    setIsVerifying(true);
    setStep("verifying");
    
    // Mock: In real implementation, this would initiate micro-deposits
    setTimeout(() => {
      setIsVerifying(false);
      setStep("success");
      setTimeout(() => {
        onSuccess("acc_" + Math.random().toString(36).substr(2, 9));
        onClose();
        setStep("method");
        setMethod(null);
      }, 2000);
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <WireModal title="Connect Bank Account" onClose={onClose} className="max-w-2xl">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-sm text-gray-600 mb-4">
          {accountType === "sender"
            ? "Connect your account to send payments"
            : "Connect your account to receive payments"}
        </div>
            {step === "method" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Connection Method</h3>
                
                {/* Instant Verification */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleMethodSelect("instant")}
                  className="w-full text-left p-6 border-2 border-black rounded-xl hover:bg-gray-50 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Instant Verification</h4>
                          <p className="text-sm text-gray-600">Connect via secure bank login</p>
                        </div>
                      </div>
                      <ul className="text-xs text-gray-600 space-y-1 mt-3 ml-15">
                        <li>✓ Verified instantly</li>
                        <li>✓ No waiting for deposits</li>
                        <li>✓ Secure bank-level encryption</li>
                      </ul>
                    </div>
                    <Badge tone="success">Recommended</Badge>
                  </div>
                </motion.button>

                {/* Manual Entry */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleMethodSelect("manual")}
                  className="w-full text-left p-6 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Manual Entry</h4>
                          <p className="text-sm text-gray-600">Enter account details manually</p>
                        </div>
                      </div>
                      <ul className="text-xs text-gray-600 space-y-1 mt-3 ml-15">
                        <li>• Verify with micro-deposits (1-3 days)</li>
                        <li>• Works with any bank</li>
                        <li>• More secure for high-value accounts</li>
                      </ul>
                    </div>
                  </div>
                </motion.button>

                {/* Security Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">Bank-Level Security</p>
                      <p className="text-xs text-blue-700">
                        All connections use bank-level encryption. We never store your bank login credentials.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === "instant" && (
              <WireInstantBankConnection
                banks={popularBanks}
                onConnect={handleInstantConnect}
                onBack={() => setStep("method")}
              />
            )}

            {step === "manual" && (
              <WireManualBankEntry
                onSubmit={handleManualSubmit}
                onBack={() => setStep("method")}
              />
            )}

            {step === "verifying" && (
              <div className="py-12 text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 border-4 border-gray-200 rounded-full" />
                  <motion.div
                    className="absolute inset-0 border-4 border-black rounded-full border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {method === "instant" ? "Connecting to your bank..." : "Initiating verification..."}
                </h3>
                <p className="text-sm text-gray-600">
                  {method === "instant" 
                    ? "Please complete authentication in the popup window"
                    : "We're sending micro-deposits to verify your account"}
                </p>
              </div>
            )}

            {step === "success" && (
              <div className="py-12 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"
                >
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Account Connected!</h3>
                <p className="text-sm text-gray-600">
                  {method === "instant" 
                    ? "Your account has been verified and is ready to use."
                    : "Micro-deposits will arrive in 1-3 business days. Check your account and verify the amounts."}
                </p>
              </div>
            )}
      </div>
    </WireModal>
  );
}

function WireInstantBankConnection({
  banks,
  onConnect,
  onBack,
}: {
  banks: Array<{ id: string; name: string; logo: string }>;
  onConnect: (bankId: string) => void;
  onBack: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredBanks = banks.filter((bank) =>
    bank.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-lg font-semibold text-gray-900">Select Your Bank</h3>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for your bank..."
          className="w-full pl-10 pr-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
        />
      </div>

      {/* Bank List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredBanks.map((bank) => (
          <motion.button
            key={bank.id}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onConnect(bank.id)}
            className="w-full text-left p-4 border-2 border-gray-200 rounded-xl hover:border-black hover:bg-gray-50 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl">
                {bank.logo}
              </div>
              <span className="font-semibold text-gray-900">{bank.name}</span>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Security Notice */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mt-4">
        <p className="text-xs text-gray-600">
          🔒 Your bank credentials are never stored. We use bank-level encryption and OAuth authentication.
        </p>
      </div>
    </div>
  );
}

function WireManualBankEntry({
  onSubmit,
  onBack,
}: {
  onSubmit: (data: any) => void;
  onBack: () => void;
}) {
  const [accountType, setAccountType] = useState<"checking" | "savings">("checking");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      accountType,
      routingNumber,
      accountNumber,
      accountHolderName,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-lg font-semibold text-gray-900">Enter Account Details</h3>
      </div>

      {/* Account Type */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
          Account Type
        </label>
        <div className="flex gap-3">
          <label className="flex-1 flex items-center gap-2 p-3 border-2 border-black rounded-xl cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              value="checking"
              checked={accountType === "checking"}
              onChange={(e) => setAccountType(e.target.value as "checking")}
              className="w-4 h-4 border-2 border-black text-black"
            />
            <span className="text-sm font-medium">Checking</span>
          </label>
          <label className="flex-1 flex items-center gap-2 p-3 border-2 border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              value="savings"
              checked={accountType === "savings"}
              onChange={(e) => setAccountType(e.target.value as "savings")}
              className="w-4 h-4 border-2 border-gray-300 text-gray-600"
            />
            <span className="text-sm font-medium">Savings</span>
          </label>
        </div>
      </div>

      {/* Routing Number */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
          Routing Number
        </label>
        <input
          type="text"
          value={routingNumber}
          onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
          placeholder="123456789"
          className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
          maxLength={9}
          required
        />
      </div>

      {/* Account Number */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
          Account Number
        </label>
        <input
          type="text"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
          placeholder="Enter account number"
          className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
          required
        />
      </div>

      {/* Account Holder Name */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
          Account Holder Name
        </label>
        <input
          type="text"
          value={accountHolderName}
          onChange={(e) => setAccountHolderName(e.target.value)}
          placeholder="John Doe"
          className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
          required
        />
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-blue-900 mb-1">Verification Process</p>
        <p className="text-xs text-blue-700">
          We'll send 2 small deposits (between $0.01 and $0.99) to your account within 1-3 business days.
          You'll need to verify these amounts to complete setup.
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full px-6 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all"
      >
        Continue to Verification
      </button>
    </form>
  );
}
