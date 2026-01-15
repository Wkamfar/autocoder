import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useWireBeneficiaries, useCreateBeneficiary, useLockBeneficiary } from "../hooks/useWireIntents";
import { WireBeneficiaryForm } from "../components/WireBeneficiaryForm";
import { WireBankConnectionModal } from "../components/WireBankConnectionModal";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { WireEmptyState, WireSkeletonTable } from "../ui/WireEmptyStates";
import { useAuth } from "../contexts/AuthContext";

export default function WireBeneficiariesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: beneficiaries, isLoading } = useWireBeneficiaries();
  const createBeneficiary = useCreateBeneficiary();
  const lockBeneficiary = useLockBeneficiary();
  const [showForm, setShowForm] = useState(false);
  const [showBankConnection, setShowBankConnection] = useState(false);
  const canCreate = Boolean(user?.permissions?.includes("beneficiary:create"));
  const canLock = Boolean(user?.permissions?.includes("beneficiary:lock"));

  const handleCreateBeneficiary = async (data: Partial<any>) => {
    if (!canCreate) return;
    await createBeneficiary.mutateAsync(data);
    setShowForm(false);
  };

  const handleLockBeneficiary = async (id: string) => {
    if (!canLock) return;
    if (confirm("Are you sure you want to lock this beneficiary?")) {
      await lockBeneficiary.mutateAsync(id);
    }
  };

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
          <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
                  Beneficiary Management
                </p>
                <h2 className="text-sm font-semibold text-gray-900">Add Beneficiary</h2>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-xs text-gray-600 hover:text-black"
              >
                ✕
              </button>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-6">
            <WireBeneficiaryForm
              onSubmit={handleCreateBeneficiary}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
                Beneficiary Management
              </p>
              <h2 className="text-sm font-semibold text-gray-900">Beneficiaries</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBankConnection(true)}
                className="px-4 py-2 border-2 border-black text-xs font-medium rounded-xl hover:bg-gray-50 transition-all"
              >
                Connect Bank
              </button>
              <button
                onClick={() => setShowForm(true)}
                disabled={!canCreate}
                title={!canCreate ? "You don’t have permission to add beneficiaries." : undefined}
                className="px-4 py-2 bg-black text-white text-xs font-medium rounded-xl hover:bg-gray-800 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Beneficiary
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Beneficiaries Table Panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="border-2 border-black rounded-2xl overflow-hidden bg-white flex flex-col"
      >
        {isLoading ? (
          <div className="p-6">
            <WireSkeletonTable rows={6} />
          </div>
        ) : !beneficiaries || beneficiaries.length === 0 ? (
          <WireEmptyState
            icon={
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
            title="No Beneficiaries"
            description="Add beneficiaries to enable secure transfers. Beneficiaries are verified and versioned for security."
            action={{
              label: "Add Beneficiary",
              onClick: () => setShowForm(true),
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-900 to-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Country
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Rails
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Bank Last 4
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Version
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {beneficiaries.map((beneficiary, index) => (
                  <motion.tr
                    key={beneficiary.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                    onClick={() => navigate(`/beneficiaries/${beneficiary.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {beneficiary.displayName}
                        </span>
                        {beneficiary.version > 1 && (
                          <Badge tone="warning">v{beneficiary.version}</Badge>
                        )}
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {beneficiary.country}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {beneficiary.railsAllowed.map((rail) => (
                          <Badge key={rail} tone="neutral">
                            {rail}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">
                      {beneficiary.bankLast4}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {beneficiary.version}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        tone={
                          beneficiary.status === "ACTIVE"
                            ? "success"
                            : beneficiary.status === "LOCKED"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {beneficiary.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {beneficiary.status === "ACTIVE" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLockBeneficiary(beneficiary.id);
                            }}
                            disabled={!canLock || lockBeneficiary.isPending}
                            title={
                              !canLock
                                ? "You don’t have permission to lock beneficiaries."
                                : lockBeneficiary.isPending
                                  ? "Locking…"
                                  : undefined
                            }
                            className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Lock
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/beneficiaries/${beneficiary.id}`);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        >
                          Intelligence →
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Bank Connection Modal */}
      {showBankConnection && (
        <WireBankConnectionModal
          isOpen={showBankConnection}
          onClose={() => setShowBankConnection(false)}
          onSuccess={(accountId) => {
            console.log("Bank connected:", accountId);
            setShowBankConnection(false);
          }}
          accountType="receiver"
        />
      )}
    </div>
  );
}
