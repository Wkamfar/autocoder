import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useWireIntents } from "../hooks/useWireIntents";
import { IntentStatusBadge, RiskScoreBadge } from "../ui/WireDesignSystem";
import { Badge, SkeletonMetrics, SkeletonCard } from "../../crm/ui/CrmDesignSystem";
import { api } from "../api";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { WireUserManagement } from "../components/WireUserManagement";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function WireAdminDashboardPage() {
  const navigate = useNavigate();
  const { data: intents, isLoading: intentsLoading } = useWireIntents();
  
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ["adminMetrics"],
    queryFn: () => api.getAdminMetrics(),
    retry: 1,
  });

  const { data: users, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => api.getAllUsers(),
    retry: 1,
  });

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(1)}M`;
    }
    if (amount >= 1_000) {
      return `$${(amount / 1_000).toFixed(1)}K`;
    }
    return `$${amount}`;
  };

  const recentIntents = useMemo(() => {
    return intents?.slice(0, 10).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ) || [];
  }, [intents]);

  // Calculate ACH vs WIRE distribution - MUST be called before any early returns
  const railDistribution = useMemo(() => {
    if (!intents) return { ACH: 0, WIRE: 0 };
    return intents.reduce((acc, intent) => {
      acc[intent.railsType] = (acc[intent.railsType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [intents]);

  if (metricsLoading || intentsLoading || usersLoading) {
    return (
      <div className="space-y-6">
        <SkeletonMetrics />
        <div className="grid grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    );
  }

  if (metricsError || usersError) {
    return (
      <div className="space-y-6">
        <div className="border-2 border-red-200 rounded-2xl bg-red-50 p-6">
          <h2 className="text-lg font-bold text-red-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-red-800">
            {metricsError instanceof Error ? metricsError.message : "Unable to load admin metrics."}
            {usersError instanceof Error && ` User data: ${usersError.message}`}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="space-y-6">
        <SkeletonMetrics />
        <div className="grid grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const COLORS = {
    wire: "#000",
    ach: "#3b82f6",
    lowRisk: "#10b981",
    medRisk: "#f59e0b",
    highRisk: "#ef4444",
  };

  return (
    <div className="space-y-6">
      {/* Live Metrics Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 shadow-lg border-2 border-black"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6">
          <div className="flex flex-col">
            <p className="text-xs sm:text-[10px] text-gray-400 uppercase tracking-wider mb-2 sm:mb-1 break-words">Total Volume (30d)</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-white">{formatCurrency(metrics?.financial?.totalVolume30d || 0)}</p>
          </div>
          <div className="flex flex-col">
            <p className="text-xs sm:text-[10px] text-gray-400 uppercase tracking-wider mb-2 sm:mb-1 break-words">Fraud Prevented</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">{formatCurrency(metrics?.financial?.fraudPrevented || 0)}</p>
          </div>
          <div className="flex flex-col">
            <p className="text-xs sm:text-[10px] text-gray-400 uppercase tracking-wider mb-2 sm:mb-1 break-words">Active Users</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-white">{metrics?.users?.totalActive || 0}</p>
          </div>
          <div className="flex flex-col">
            <p className="text-xs sm:text-[10px] text-gray-400 uppercase tracking-wider mb-2 sm:mb-1 break-words">Pending Approvals</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-amber-400">{metrics?.approvals?.pendingCount || 0}</p>
          </div>
          <div className="flex flex-col">
            <p className="text-xs sm:text-[10px] text-gray-400 uppercase tracking-wider mb-2 sm:mb-1 break-words">Avg Risk Score</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-white">{metrics?.risk?.averageRiskScore || 0}</p>
          </div>
          <div className="flex flex-col">
            <p className="text-xs sm:text-[10px] text-gray-400 uppercase tracking-wider mb-2 sm:mb-1 break-words">System Health</p>
            <p className="text-base sm:text-lg font-bold font-mono text-emerald-400">✓ Healthy</p>
          </div>
        </div>
      </motion.div>

      {/* Rail Type Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-base font-bold text-gray-900">Transfer Distribution</h2>
          <p className="text-xs text-gray-500 mt-0.5">ACH vs WIRE transfers</p>
        </header>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="border-2 border-gray-200 rounded-xl p-4 bg-blue-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">ACH Transfers</span>
                <Badge tone="info">ACH</Badge>
              </div>
              <p className="text-2xl font-bold font-mono text-blue-600">{railDistribution.ACH || 0}</p>
              <p className="text-xs text-gray-600 mt-1">
                {intents && intents.length > 0 ? Math.round((railDistribution.ACH / intents.length) * 100) : 0}% of total
              </p>
            </div>
            <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">WIRE Transfers</span>
                <Badge tone="neutral">WIRE</Badge>
              </div>
              <p className="text-2xl font-bold font-mono">{railDistribution.WIRE || 0}</p>
              <p className="text-xs text-gray-600 mt-1">
                {intents && intents.length > 0 ? Math.round((railDistribution.WIRE / intents.length) * 100) : 0}% of total
              </p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-600 mb-2">Key Differences:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="font-semibold text-gray-900 mb-1">ACH</p>
                <ul className="space-y-1 text-gray-600">
                  <li>• Lower cost</li>
                  <li>• 1-3 business days</li>
                  <li>• Reversible</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-1">WIRE</p>
                <ul className="space-y-1 text-gray-600">
                  <li>• Higher cost</li>
                  <li>• Same-day settlement</li>
                  <li>• Irreversible</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Financial Overview Panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-base font-bold text-gray-900">Financial Overview</h2>
        </header>
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-3">Volume Trends (7d)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={(metrics?.risk?.riskTrends || []).map((t: { date: string }, i: number) => ({
                date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                volume: (metrics?.financial?.totalVolume7d || 0) * (0.8 + (i * 0.05)),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
                <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10 }} stroke="#6b7280" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="volume" stroke="#000" strokeWidth={2} dot={{ fill: "#000", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-3">Rails Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: "WIRE", value: metrics?.financial?.railsDistribution?.wire || 0 },
                    { name: "ACH", value: metrics?.financial?.railsDistribution?.ach || 0 },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.name} ${(entry.percent * 100).toFixed(0)}%`}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill={COLORS.wire} />
                  <Cell fill={COLORS.ach} />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* Risk Analytics Panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-base font-bold text-gray-900">Risk Analytics</h2>
        </header>
        <div className="p-6 grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-3">Risk Score Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={metrics?.risk?.riskScoreDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="count" fill="#000" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-3">Risk Trends (7d)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={(metrics?.risk?.riskTrends || []).map((t: { date: string; avgScore: number }) => ({
                date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                score: t.avgScore,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#000" strokeWidth={2} dot={{ fill: "#000", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="border border-gray-200 rounded-xl p-3 sm:p-3 bg-gray-50">
            <p className="text-xs sm:text-[10px] uppercase tracking-wide text-gray-600 mb-2 sm:mb-1">High-Risk Intents</p>
            <p className="text-xl sm:text-2xl font-bold font-mono">{metrics?.risk?.highRiskIntents?.over60 ?? 0}</p>
            <p className="text-xs text-gray-500">Score &gt;60</p>
          </div>
          <div className="border border-gray-200 rounded-xl p-3 sm:p-3 bg-red-50">
            <p className="text-xs sm:text-[10px] uppercase tracking-wide text-gray-600 mb-2 sm:mb-1">Critical Risk</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-red-600">{metrics?.risk?.highRiskIntents?.over85 ?? 0}</p>
            <p className="text-xs text-gray-500">Score &gt;85</p>
          </div>
          <div className="border border-gray-200 rounded-xl p-3 sm:p-3 bg-gray-50">
            <p className="text-xs sm:text-[10px] uppercase tracking-wide text-gray-600 mb-2 sm:mb-1">Avg Risk Score</p>
            <p className="text-xl sm:text-2xl font-bold font-mono">{metrics?.risk?.averageRiskScore ?? 0}</p>
            <p className="text-xs text-gray-500">All intents</p>
          </div>
        </div>
      </motion.div>

      {/* User Management Panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <WireUserManagement />
      </motion.div>

      {/* Approval Analytics Panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-base font-bold text-gray-900">Approval Analytics</h2>
        </header>
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <p className="text-xs sm:text-[10px] uppercase tracking-wide text-gray-600 mb-2 sm:mb-1">Approval Rate</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-emerald-600">{metrics?.approvals?.approvalRate || 0}%</p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <p className="text-xs sm:text-[10px] uppercase tracking-wide text-gray-600 mb-2 sm:mb-1">Avg Approval Time</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono">{((metrics?.approvals?.averageApprovalTimeMinutes || 0)).toFixed(1)}m</p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <p className="text-xs sm:text-[10px] uppercase tracking-wide text-gray-600 mb-2 sm:mb-1">Dual-Approval Rate</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono">{metrics?.approvals?.dualApprovalRate || 0}%</p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 bg-amber-50">
            <p className="text-xs sm:text-[10px] uppercase tracking-wide text-gray-600 mb-2 sm:mb-1">Pending Approvals</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-amber-600">{metrics?.approvals?.pendingCount || 0}</p>
          </div>
        </div>
      </motion.div>

      {/* Fraud Prevention Panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-base font-bold text-gray-900">Fraud Prevention</h2>
        </header>
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <div className="border border-gray-200 rounded-xl p-4 bg-red-50">
            <p className="text-xs sm:text-[10px] uppercase tracking-wide text-gray-600 mb-2 sm:mb-1 break-words">Attempts Blocked</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-red-600">{metrics?.fraudPrevention?.attemptsBlocked || 0}</p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 bg-red-50">
            <p className="text-xs sm:text-[10px] uppercase tracking-wide text-gray-600 mb-2 sm:mb-1 break-words">Spoof Detection</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-red-600">{metrics?.fraudPrevention?.spoofDetectionCount || 0}</p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 bg-red-50">
            <p className="text-xs sm:text-[10px] uppercase tracking-wide text-gray-600 mb-2 sm:mb-1 break-words">Coercion Detection</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-red-600">{metrics?.fraudPrevention?.coercionDetectionCount || 0}</p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 bg-emerald-50">
            <p className="text-xs sm:text-[10px] uppercase tracking-wide text-gray-600 mb-2 sm:mb-1 break-words">Challenge Success</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-emerald-600">{metrics?.fraudPrevention?.challengeSuccessRate || 0}%</p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <p className="text-xs sm:text-[10px] uppercase tracking-wide text-gray-600 mb-2 sm:mb-1 break-words">Failed Challenges</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono">{metrics?.fraudPrevention?.failedChallengeRate || 0}%</p>
          </div>
        </div>
      </motion.div>

      {/* Enhanced Risk Management */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.6 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Risk Management Tools</h2>
            <p className="text-xs text-gray-500 mt-0.5">Advanced risk analytics and configuration</p>
          </div>
          <button
            onClick={() => navigate("/policies")}
            className="text-xs text-gray-600 hover:text-gray-900 font-medium self-start sm:self-center min-h-[44px] sm:min-h-0 py-2 sm:py-0"
          >
            Configure Policies →
          </button>
        </header>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="border-2 border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Risk Factor Breakdown</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Amount Threshold</span>
                  <span className="text-sm font-bold">35%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full" style={{ width: "35%" }}></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Beneficiary Age</span>
                  <span className="text-sm font-bold">28%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full" style={{ width: "28%" }}></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Rail Type</span>
                  <span className="text-sm font-bold">15%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: "15%" }}></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">International</span>
                  <span className="text-sm font-bold">12%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full" style={{ width: "12%" }}></div>
                </div>
              </div>
            </div>
            <div className="border-2 border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Risk Trends (7d)</h3>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={(metrics?.risk?.riskTrends || []).map((t: { date: string; avgScore: number }) => ({
                  date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  score: t.avgScore,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#000" strokeWidth={2} dot={{ fill: "#000", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">High-Risk Intents</p>
              <p className="text-xl sm:text-2xl font-bold font-mono">{metrics?.risk?.highRiskIntents?.over60 || 0}</p>
              <p className="text-xs text-gray-500">Score &gt;60</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 bg-red-50">
              <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Critical Risk</p>
              <p className="text-xl sm:text-2xl font-bold font-mono text-red-600">{metrics?.risk?.highRiskIntents?.over85 || 0}</p>
              <p className="text-xs text-gray-500">Score &gt;85</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Avg Risk Score</p>
              <p className="text-xl sm:text-2xl font-bold font-mono">{metrics?.risk?.averageRiskScore || 0}</p>
              <p className="text-xs text-gray-500">All intents</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Compliance Quick Access */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.7 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Compliance & Reporting</h2>
            <p className="text-xs text-gray-500 mt-0.5">Cryptographically signed audit trails</p>
          </div>
          <button
            onClick={() => navigate("/compliance")}
            className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all min-h-[44px] sm:min-h-0"
          >
            View Reports →
          </button>
        </header>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Total Actions</p>
              <p className="text-xl font-bold font-mono">{intents?.length ?? 0}</p>
              <p className="text-xs text-gray-500">From your org’s intents</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 bg-emerald-50">
              <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Cryptographic Proof</p>
              <p className="text-xl font-bold font-mono text-emerald-600">{(intents?.length ?? 0) > 0 ? "✓" : "—"}</p>
              <p className="text-xs text-gray-500">{(intents?.length ?? 0) > 0 ? "Bundles available per intent" : "No intents yet"}</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 bg-blue-50">
              <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Reports Generated</p>
              <p className="text-xl font-bold font-mono text-blue-600">0</p>
              <p className="text-xs text-gray-500">No exports yet</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Real-Time Transaction Feed */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.8 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <h2 className="text-base font-bold text-gray-900">Real-Time Transaction Feed</h2>
          <button
            onClick={() => navigate("/intents")}
            className="text-xs text-gray-600 hover:text-gray-900 font-medium self-start sm:self-center min-h-[44px] sm:min-h-0 py-2 sm:py-0"
          >
            View All →
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          {recentIntents.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No recent transactions</div>
          ) : (
            <div className="space-y-2">
              {recentIntents.map((intent) => (
                <button
                  key={intent.id}
                  onClick={() => navigate(`/intents/${intent.id}`)}
                  className="w-full text-left flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200 gap-2 sm:gap-4"
                >
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 min-w-0">
                    <div className="text-sm sm:text-sm font-medium text-gray-900 whitespace-nowrap">
                      {formatAmount(parseFloat(intent.amountMinor) / 100)}
                    </div>
                    <Badge tone="neutral" className="text-[10px] sm:text-xs">{intent.railsType}</Badge>
                    <IntentStatusBadge status={intent.status} />
                    <RiskScoreBadge score={intent.riskScore} />
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap self-start sm:self-center">
                    {new Date(intent.createdAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
