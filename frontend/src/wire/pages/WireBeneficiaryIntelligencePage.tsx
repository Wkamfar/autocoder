import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { useWireBeneficiaries } from "../hooks/useWireIntents";
import { useWireIntents } from "../hooks/useWireIntents";
import { api } from "../api";
import { useAuth } from "../contexts/AuthContext";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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

type IntelligenceTab = 
  | "overview"
  | "ledger"
  | "intelligence"
  | "risk"
  | "patterns"
  | "admin"
  | "documents"
  | "compliance"
  | "audit";

interface VendorIntelligence {
  // Relationship Intelligence
  relationshipMetrics: {
    totalTransfers: number;
    totalVolume: number;
    averageTransferAmount: number;
    largestTransfer: number;
    relationshipDuration: number; // days
    transferFrequency: number; // transfers per month
    onTimePaymentRate: number; // percentage
    disputeRate: number; // percentage
    communicationScore: number; // 0-100
    trustScore: number; // 0-100
  };
  
  // Behavioral Patterns
  behavioralPatterns: {
    preferredTransferDays: string[]; // ["Monday", "Wednesday"]
    preferredTransferTimes: string[]; // ["09:00", "14:00"]
    seasonalPatterns: Array<{ month: string; volume: number }>;
    amountPatterns: Array<{ range: string; count: number }>;
    approvalPatterns: {
      averageApprovalTime: number; // minutes
      approvalRate: number; // percentage
      denialReasons: Array<{ reason: string; count: number }>;
    };
  };
  
  // Risk Analysis
  riskAnalysis: {
    currentRiskScore: number;
    riskTrend: Array<{ date: string; score: number }>;
    riskFactors: Array<{
      factor: string;
      severity: "low" | "medium" | "high" | "critical";
      description: string;
      lastDetected: string;
    }>;
    anomalyDetections: Array<{
      type: string;
      detectedAt: string;
      severity: string;
      description: string;
      resolved: boolean;
    }>;
  };
  
  // Predictive Analytics
  predictiveAnalytics: {
    nextTransferPrediction: {
      predictedDate: string;
      confidence: number;
      predictedAmount: number;
    };
    volumeForecast: Array<{ month: string; predicted: number; confidence: number }>;
    riskForecast: Array<{ month: string; predictedRisk: number }>;
  };
  
  // Admin Controls
  adminControls: {
    caps: {
      dailyLimit?: number;
      monthlyLimit?: number;
      perTransferLimit?: number;
      annualLimit?: number;
    };
    restrictions: string[];
    notes: Array<{
      id: string;
      author: string;
      content: string;
      createdAt: string;
      modifiedAt?: string;
    }>;
    tags: string[];
    flags: Array<{
      type: string;
      reason: string;
      setBy: string;
      setAt: string;
    }>;
  };
  
  // Communication History
  communicationHistory: Array<{
    id: string;
    type: "email" | "phone" | "meeting" | "document";
    subject: string;
    participants: string[];
    date: string;
    summary: string;
  }>;
  
  // Document Repository
  documents: Array<{
    id: string;
    name: string;
    type: string;
    uploadedAt: string;
    uploadedBy: string;
    size: number;
    url: string;
  }>;
  
  // Compliance Tracking
  compliance: {
    kycStatus: "verified" | "pending" | "expired";
    kycExpiry: string;
    sanctionsCheck: "clear" | "flagged" | "pending";
    lastSanctionsCheck: string;
    regulatoryFlags: string[];
    certifications: Array<{
      type: string;
      issuer: string;
      expiry: string;
      status: string;
    }>;
  };
  
  // Audit Trail
  auditTrail: Array<{
    id: string;
    action: string;
    actor: string;
    timestamp: string;
    details: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }>;
}

// Mock intelligence data generator
const generateVendorIntelligence = (beneficiaryId: string): VendorIntelligence => {
  return {
    relationshipMetrics: {
      totalTransfers: 47,
      totalVolume: 12500000,
      averageTransferAmount: 265957,
      largestTransfer: 1500000,
      relationshipDuration: 342,
      transferFrequency: 4.2,
      onTimePaymentRate: 98.5,
      disputeRate: 0.5,
      communicationScore: 87,
      trustScore: 92,
    },
    behavioralPatterns: {
      preferredTransferDays: ["Monday", "Wednesday", "Friday"],
      preferredTransferTimes: ["09:00", "14:00", "16:00"],
      seasonalPatterns: [
        { month: "Jan", volume: 1200000 },
        { month: "Feb", volume: 1100000 },
        { month: "Mar", volume: 1300000 },
        { month: "Apr", volume: 1250000 },
        { month: "May", volume: 1400000 },
        { month: "Jun", volume: 1350000 },
      ],
      amountPatterns: [
        { range: "$0-$50k", count: 12 },
        { range: "$50k-$200k", count: 18 },
        { range: "$200k-$500k", count: 12 },
        { range: "$500k+", count: 5 },
      ],
      approvalPatterns: {
        averageApprovalTime: 3.2,
        approvalRate: 97.8,
        denialReasons: [
          { reason: "Amount exceeded limit", count: 1 },
          { reason: "Missing documentation", count: 0 },
        ],
      },
    },
    riskAnalysis: {
      currentRiskScore: 28,
      riskTrend: [
        { date: "2024-07", score: 32 },
        { date: "2024-08", score: 30 },
        { date: "2024-09", score: 29 },
        { date: "2024-10", score: 27 },
        { date: "2024-11", score: 28 },
        { date: "2024-12", score: 26 },
        { date: "2025-01", score: 28 },
      ],
      riskFactors: [
        {
          factor: "New Beneficiary",
          severity: "low",
          description: "Beneficiary added less than 90 days ago",
          lastDetected: "2025-01-10",
        },
        {
          factor: "High Volume",
          severity: "medium",
          description: "Transfer volume increased 35% in last 30 days",
          lastDetected: "2025-01-15",
        },
      ],
      anomalyDetections: [
        {
          type: "Unusual Transfer Time",
          detectedAt: "2025-01-18T22:30:00Z",
          severity: "low",
          description: "Transfer initiated outside normal business hours",
          resolved: true,
        },
      ],
    },
    predictiveAnalytics: {
      nextTransferPrediction: {
        predictedDate: "2025-01-27",
        confidence: 78,
        predictedAmount: 285000,
      },
      volumeForecast: [
        { month: "Feb 2025", predicted: 1450000, confidence: 82 },
        { month: "Mar 2025", predicted: 1500000, confidence: 75 },
        { month: "Apr 2025", predicted: 1480000, confidence: 70 },
      ],
      riskForecast: [
        { month: "Feb 2025", predictedRisk: 26 },
        { month: "Mar 2025", predictedRisk: 25 },
        { month: "Apr 2025", predictedRisk: 24 },
      ],
    },
    adminControls: {
      caps: {
        dailyLimit: 500000,
        monthlyLimit: 2000000,
        perTransferLimit: 1500000,
        annualLimit: 20000000,
      },
      restrictions: ["Requires dual approval for transfers > $500k"],
      notes: [
        {
          id: "note_1",
          author: "Admin User",
          content: "Primary vendor for Q1 operations. Excellent payment history.",
          createdAt: "2025-01-10T09:00:00Z",
        },
        {
          id: "note_2",
          author: "Sarah Johnson",
          content: "Contact: john@vendorabc.com. Prefers ACH for regular payments.",
          createdAt: "2025-01-12T14:30:00Z",
        },
      ],
      tags: ["Primary Vendor", "Q1 Operations", "Trusted Partner"],
      flags: [],
    },
    communicationHistory: [
      {
        id: "comm_1",
        type: "email",
        subject: "Q1 Payment Schedule",
        participants: ["alice@acme.com", "john@vendorabc.com"],
        date: "2025-01-15T10:00:00Z",
        summary: "Discussed Q1 payment schedule and terms",
      },
      {
        id: "comm_2",
        type: "phone",
        subject: "Payment Inquiry",
        participants: ["bob@acme.com", "john@vendorabc.com"],
        date: "2025-01-18T14:00:00Z",
        summary: "Confirmed receipt of payment #12345",
      },
    ],
    documents: [
      {
        id: "doc_1",
        name: "Vendor Agreement.pdf",
        type: "contract",
        uploadedAt: "2025-01-10T09:00:00Z",
        uploadedBy: "Admin User",
        size: 2456789,
        url: "#",
      },
      {
        id: "doc_2",
        name: "W-9 Form.pdf",
        type: "tax",
        uploadedAt: "2025-01-10T09:15:00Z",
        uploadedBy: "Admin User",
        size: 123456,
        url: "#",
      },
    ],
    compliance: {
      kycStatus: "verified",
      kycExpiry: "2026-01-10",
      sanctionsCheck: "clear",
      lastSanctionsCheck: "2025-01-10T09:00:00Z",
      regulatoryFlags: [],
      certifications: [
        {
          type: "ISO 27001",
          issuer: "Certification Body",
          expiry: "2025-12-31",
          status: "valid",
        },
      ],
    },
    auditTrail: [
      {
        id: "audit_1",
        action: "BENEFICIARY_CREATED",
        actor: "Admin User",
        timestamp: "2025-01-10T09:00:00Z",
        details: { beneficiaryId, version: 1 },
        ipAddress: "192.168.1.100",
      },
      {
        id: "audit_2",
        action: "CAPS_UPDATED",
        actor: "Admin User",
        timestamp: "2025-01-12T10:30:00Z",
        details: { dailyLimit: 500000, monthlyLimit: 2000000 },
        ipAddress: "192.168.1.100",
      },
      {
        id: "audit_3",
        action: "NOTE_ADDED",
        actor: "Sarah Johnson",
        timestamp: "2025-01-12T14:30:00Z",
        details: { noteId: "note_2" },
        ipAddress: "192.168.1.105",
      },
    ],
  };
};

export default function WireBeneficiaryIntelligencePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<IntelligenceTab>("overview");
  const [showAddNote, setShowAddNote] = useState(false);
  const [showEditCaps, setShowEditCaps] = useState(false);
  const [newNote, setNewNote] = useState("");

  const { data: beneficiaries } = useWireBeneficiaries();
  const { data: intents } = useWireIntents();
  
  const beneficiary = beneficiaries?.find((b) => b.id === id);
  
  const { data: intelligence, isLoading: intelligenceLoading } = useQuery({
    queryKey: ["vendorIntelligence", id],
    queryFn: () => api.wireApi.getBeneficiaryIntelligence(id || ""),
    enabled: !!id,
    // Fallback to empty data structure if API fails or no data yet
    placeholderData: () => {
      // Return minimal structure for new beneficiaries with no transfers yet
      return {
        relationshipMetrics: {
          totalTransfers: 0,
          totalVolume: 0,
          averageTransferAmount: 0,
          largestTransfer: 0,
          relationshipDuration: 0,
          transferFrequency: 0,
          onTimePaymentRate: 0,
          disputeRate: 0,
          communicationScore: 0,
          trustScore: 0,
        },
        behavioralPatterns: {
          preferredTransferDays: [],
          preferredTransferTimes: [],
          seasonalPatterns: [],
          amountPatterns: [],
          approvalPatterns: {
            averageApprovalTime: 0,
            approvalRate: 0,
            denialReasons: [],
          },
        },
        riskAnalysis: {
          currentRiskScore: 0,
          riskTrend: [],
          riskFactors: [],
          anomalyDetections: [],
        },
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
          kycStatus: "pending" as const,
          kycExpiry: "",
          sanctionsCheck: "clear" as const,
          lastSanctionsCheck: "",
          regulatoryFlags: [],
          certifications: [],
        },
        auditTrail: [],
      };
    },
  });

  // Filter intents for this beneficiary
  const beneficiaryIntents = useMemo(() => {
    if (!intents || !id) return [];
    return intents
      .filter((intent) => intent.beneficiaryId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [intents, id]);

  if (!beneficiary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600">Beneficiary not found</p>
        </div>
      </div>
    );
  }

  if (intelligenceLoading || !intelligence) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600">Loading vendor intelligence...</p>
        </div>
      </div>
    );
  }

  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const TABS: Array<{ id: IntelligenceTab; label: string; icon: React.ReactNode }> = [
    {
      id: "overview",
      label: "Overview",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: "ledger",
      label: "Ledger",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: "intelligence",
      label: "Intelligence",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      id: "risk",
      label: "Risk Analysis",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      id: "patterns",
      label: "Patterns",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
    },
    {
      id: "admin",
      label: "Admin Controls",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: "documents",
      label: "Documents",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: "compliance",
      label: "Compliance",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: "audit",
      label: "Audit Trail",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/beneficiaries")}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{beneficiary.displayName}</h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  Deep Intelligence & Analytics • {intelligence.relationshipMetrics.totalTransfers} transfers • {formatCurrency(intelligence.relationshipMetrics.totalVolume)} total
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={beneficiary.status === "ACTIVE" ? "success" : "danger"}>
                {beneficiary.status}
              </Badge>
              {beneficiary.version > 1 && (
                <Badge tone="warning">v{beneficiary.version}</Badge>
              )}
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="border-b border-gray-100 px-4 sm:px-6">
          <div className="flex items-center gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                  activeTab === tab.id
                    ? "border-black text-black"
                    : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === "overview" && <OverviewTab intelligence={intelligence} beneficiary={beneficiary} />}
        {activeTab === "ledger" && <LedgerTab intents={beneficiaryIntents} />}
        {activeTab === "intelligence" && <IntelligenceTab intelligence={intelligence} />}
        {activeTab === "risk" && <RiskTab intelligence={intelligence} />}
        {activeTab === "patterns" && <PatternsTab intelligence={intelligence} />}
        {activeTab === "admin" && (
          <AdminTab
            intelligence={intelligence}
            beneficiary={beneficiary}
            isAdmin={isAdmin}
            showAddNote={showAddNote}
            setShowAddNote={setShowAddNote}
            newNote={newNote}
            setNewNote={setNewNote}
            showEditCaps={showEditCaps}
            setShowEditCaps={setShowEditCaps}
          />
        )}
        {activeTab === "documents" && <DocumentsTab intelligence={intelligence} isAdmin={isAdmin} />}
        {activeTab === "compliance" && <ComplianceTab intelligence={intelligence} />}
        {activeTab === "audit" && <AuditTrailTab intelligence={intelligence} />}
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ intelligence, beneficiary }: { intelligence: VendorIntelligence; beneficiary: any }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-black rounded-xl p-4 sm:p-5 bg-white"
        >
          <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Total Volume</p>
          <p className="text-2xl sm:text-3xl font-bold font-mono">{formatCurrency(intelligence.relationshipMetrics.totalVolume)}</p>
          <p className="text-xs text-gray-500 mt-1">{intelligence.relationshipMetrics.totalTransfers} transfers</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="border-2 border-black rounded-xl p-4 sm:p-5 bg-white"
        >
          <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Trust Score</p>
          <p className="text-2xl sm:text-3xl font-bold font-mono text-emerald-600">{intelligence.relationshipMetrics.trustScore}</p>
          <p className="text-xs text-gray-500 mt-1">Out of 100</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="border-2 border-black rounded-xl p-4 sm:p-5 bg-white"
        >
          <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">On-Time Rate</p>
          <p className="text-2xl sm:text-3xl font-bold font-mono text-emerald-600">{intelligence.relationshipMetrics.onTimePaymentRate}%</p>
          <p className="text-xs text-gray-500 mt-1">Payment reliability</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="border-2 border-black rounded-xl p-4 sm:p-5 bg-white"
        >
          <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Risk Score</p>
          <p className="text-2xl sm:text-3xl font-bold font-mono text-blue-600">{intelligence.riskAnalysis.currentRiskScore}</p>
          <p className="text-xs text-gray-500 mt-1">Current risk level</p>
        </motion.div>
      </div>

      {/* Relationship Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">Relationship Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Relationship Duration</span>
              <span className="text-sm font-semibold">{intelligence.relationshipMetrics.relationshipDuration} days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Average Transfer</span>
              <span className="text-sm font-semibold">{formatCurrency(intelligence.relationshipMetrics.averageTransferAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Largest Transfer</span>
              <span className="text-sm font-semibold">{formatCurrency(intelligence.relationshipMetrics.largestTransfer)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Transfer Frequency</span>
              <span className="text-sm font-semibold">{intelligence.relationshipMetrics.transferFrequency} transfers/month</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Communication Score</span>
              <span className="text-sm font-semibold">{intelligence.relationshipMetrics.communicationScore}/100</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Dispute Rate</span>
              <span className="text-sm font-semibold text-red-600">{intelligence.relationshipMetrics.disputeRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Approval Rate</span>
              <span className="text-sm font-semibold text-emerald-600">{intelligence.behavioralPatterns.approvalPatterns.approvalRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Avg Approval Time</span>
              <span className="text-sm font-semibold">{intelligence.behavioralPatterns.approvalPatterns.averageApprovalTime} minutes</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* AI-Powered Insights */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-4 sm:p-6 text-white"
      >
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h2 className="text-lg font-bold">AI-Powered Intelligence Insights</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
            <p className="text-xs uppercase tracking-wide text-gray-300 mb-2">Pattern Detection</p>
            <p className="text-sm text-white">
              Vendor shows consistent payment patterns with {intelligence.behavioralPatterns.approvalPatterns.approvalRate}% approval rate. 
              Transfers typically occur on {intelligence.behavioralPatterns.preferredTransferDays.join(", ")}.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
            <p className="text-xs uppercase tracking-wide text-gray-300 mb-2">Risk Assessment</p>
            <p className="text-sm text-white">
              Risk score trending downward (from 32 to {intelligence.riskAnalysis.currentRiskScore}). 
              Relationship maturity and consistent behavior indicate high trustworthiness.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
            <p className="text-xs uppercase tracking-wide text-gray-300 mb-2">Predictive Analysis</p>
            <p className="text-sm text-white">
              Next transfer predicted: {new Date(intelligence.predictiveAnalytics.nextTransferPrediction.predictedDate).toLocaleDateString()} 
              ({intelligence.predictiveAnalytics.nextTransferPrediction.confidence}% confidence). 
              Expected amount: {formatCurrency(intelligence.predictiveAnalytics.nextTransferPrediction.predictedAmount)}.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
            <p className="text-xs uppercase tracking-wide text-gray-300 mb-2">Relationship Health</p>
            <p className="text-sm text-white">
              {intelligence.relationshipMetrics.relationshipDuration} day relationship with {intelligence.relationshipMetrics.onTimePaymentRate}% on-time rate. 
              Communication score: {intelligence.relationshipMetrics.communicationScore}/100. 
              Trust score: {intelligence.relationshipMetrics.trustScore}/100.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Quick Insights */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">Admin Notes</h2>
        <div className="space-y-3">
          {intelligence.adminControls.notes.slice(0, 2).map((note) => (
            <div key={note.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold text-gray-900">{note.author}</span>
                <span className="text-xs text-gray-500">{new Date(note.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-700">{note.content}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// Ledger Tab Component
function LedgerTab({ intents }: { intents: any[] }) {
  const formatCurrency = (amountMinor: string, currency: string) => {
    const amount = parseFloat(amountMinor) / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white overflow-hidden"
      >
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-base font-bold text-gray-900">Complete Transaction Ledger</h2>
          <p className="text-xs text-gray-500 mt-0.5">{intents.length} transactions</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-900 to-gray-800">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Rail</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Risk</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Created By</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {intents.map((intent, index) => (
                <motion.tr
                  key={intent.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(intent.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">
                    {intent.id.slice(0, 12)}...
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {formatCurrency(intent.amountMinor, intent.currency)}
                  </td>
                  <td className="px-6 py-4">
                    <Badge tone={intent.railsType === "ACH" ? "info" : "neutral"}>
                      {intent.railsType}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      tone={
                        intent.status === "EXECUTED" ? "success" :
                        intent.status === "DENIED" ? "danger" :
                        intent.status === "APPROVED" ? "info" : "warning"
                      }
                    >
                      {intent.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-semibold ${
                      intent.riskScore <= 30 ? "text-emerald-600" :
                      intent.riskScore <= 60 ? "text-amber-600" :
                      intent.riskScore <= 80 ? "text-orange-600" : "text-red-600"
                    }`}>
                      {intent.riskScore}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {intent.createdByUserId}
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      View →
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

// Intelligence Tab Component
function IntelligenceTab({ intelligence }: { intelligence: VendorIntelligence }) {
  return (
    <div className="space-y-6">
      {/* Predictive Analytics */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">Predictive Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border-2 border-gray-200 rounded-xl p-4 bg-blue-50">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Next Transfer Prediction</h3>
            <p className="text-2xl font-bold font-mono mb-1">
              {new Date(intelligence.predictiveAnalytics.nextTransferPrediction.predictedDate).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-600 mb-3">
              Predicted Amount: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(intelligence.predictiveAnalytics.nextTransferPrediction.predictedAmount)}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${intelligence.predictiveAnalytics.nextTransferPrediction.confidence}%` }}
                ></div>
              </div>
              <span className="text-xs font-semibold">{intelligence.predictiveAnalytics.nextTransferPrediction.confidence}% confidence</span>
            </div>
          </div>
          <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Volume Forecast</h3>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={intelligence.predictiveAnalytics.volumeForecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
                <Tooltip />
                <Line type="monotone" dataKey="predicted" stroke="#000" strokeWidth={2} dot={{ fill: "#000", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* Communication History */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">Communication History</h2>
        <div className="space-y-3">
          {intelligence.communicationHistory.map((comm) => (
            <div key={comm.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge tone="info">{comm.type}</Badge>
                  <span className="text-sm font-semibold text-gray-900">{comm.subject}</span>
                </div>
                <span className="text-xs text-gray-500">{new Date(comm.date).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-600 mb-1">{comm.summary}</p>
              <p className="text-xs text-gray-500">Participants: {comm.participants.join(", ")}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// Risk Tab Component
function RiskTab({ intelligence }: { intelligence: VendorIntelligence }) {
  return (
    <div className="space-y-6">
      {/* Risk Score Trend */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">Risk Score Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={intelligence.riskAnalysis.riskTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
            <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
            <Tooltip />
            <Line type="monotone" dataKey="score" stroke="#000" strokeWidth={2} dot={{ fill: "#000", r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Risk Factors */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">Active Risk Factors</h2>
        <div className="space-y-3">
          {intelligence.riskAnalysis.riskFactors.map((factor, index) => (
            <div
              key={index}
              className={`border-2 rounded-xl p-4 ${
                factor.severity === "critical" ? "border-red-500 bg-red-50" :
                factor.severity === "high" ? "border-orange-500 bg-orange-50" :
                factor.severity === "medium" ? "border-amber-500 bg-amber-50" :
                "border-blue-500 bg-blue-50"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{factor.factor}</h3>
                <Badge
                  tone={
                    factor.severity === "critical" ? "danger" :
                    factor.severity === "high" ? "warning" :
                    factor.severity === "medium" ? "warning" : "info"
                  }
                >
                  {factor.severity.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-gray-700 mb-1">{factor.description}</p>
              <p className="text-xs text-gray-500">Last detected: {new Date(factor.lastDetected).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Anomaly Detections */}
      {intelligence.riskAnalysis.anomalyDetections.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
        >
          <h2 className="text-lg font-bold text-gray-900 mb-4">Anomaly Detections</h2>
          <div className="space-y-3">
            {intelligence.riskAnalysis.anomalyDetections.map((anomaly, index) => (
              <div key={index} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{anomaly.type}</h3>
                  <Badge tone={anomaly.resolved ? "success" : "warning"}>
                    {anomaly.resolved ? "Resolved" : "Active"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-700 mb-1">{anomaly.description}</p>
                <p className="text-xs text-gray-500">
                  Detected: {new Date(anomaly.detectedAt).toLocaleString()} • Severity: {anomaly.severity}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Patterns Tab Component
function PatternsTab({ intelligence }: { intelligence: VendorIntelligence }) {
  return (
    <div className="space-y-6">
      {/* Transfer Patterns */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">Transfer Patterns</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Preferred Transfer Days</h3>
            <div className="flex flex-wrap gap-2">
              {intelligence.behavioralPatterns.preferredTransferDays.map((day) => (
                <Badge key={day} tone="info">{day}</Badge>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Preferred Transfer Times</h3>
            <div className="flex flex-wrap gap-2">
              {intelligence.behavioralPatterns.preferredTransferTimes.map((time) => (
                <Badge key={time} tone="neutral">{time}</Badge>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Seasonal Patterns */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">Seasonal Volume Patterns</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={intelligence.behavioralPatterns.seasonalPatterns}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#6b7280" />
            <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
            <Tooltip />
            <Bar dataKey="volume" fill="#000" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Amount Patterns */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">Amount Distribution</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={intelligence.behavioralPatterns.amountPatterns}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => `${entry.range}: ${entry.count}`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="count"
            >
              {intelligence.behavioralPatterns.amountPatterns.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={["#000", "#3b82f6", "#10b981", "#f59e0b"][index]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}

// Admin Tab Component
function AdminTab({
  intelligence,
  beneficiary,
  isAdmin,
  showAddNote,
  setShowAddNote,
  newNote,
  setNewNote,
  showEditCaps,
  setShowEditCaps,
}: {
  intelligence: VendorIntelligence;
  beneficiary: any;
  isAdmin: boolean;
  showAddNote: boolean;
  setShowAddNote: (show: boolean) => void;
  newNote: string;
  setNewNote: (note: string) => void;
  showEditCaps: boolean;
  setShowEditCaps: (show: boolean) => void;
}) {
  if (!isAdmin) {
    return (
      <div className="border-2 border-gray-200 rounded-2xl bg-gray-50 p-6 text-center">
        <p className="text-gray-600">Admin access required to view this section.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Caps & Limits */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Caps & Limits</h2>
          <button
            onClick={() => setShowEditCaps(true)}
            className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all"
          >
            Edit Caps
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Daily Limit</p>
            <p className="text-xl font-bold font-mono">
              {intelligence.adminControls.caps.dailyLimit
                ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(intelligence.adminControls.caps.dailyLimit)
                : "No limit"}
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Monthly Limit</p>
            <p className="text-xl font-bold font-mono">
              {intelligence.adminControls.caps.monthlyLimit
                ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(intelligence.adminControls.caps.monthlyLimit)
                : "No limit"}
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Per Transfer Limit</p>
            <p className="text-xl font-bold font-mono">
              {intelligence.adminControls.caps.perTransferLimit
                ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(intelligence.adminControls.caps.perTransferLimit)
                : "No limit"}
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Annual Limit</p>
            <p className="text-xl font-bold font-mono">
              {intelligence.adminControls.caps.annualLimit
                ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(intelligence.adminControls.caps.annualLimit)
                : "No limit"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Restrictions */}
      {intelligence.adminControls.restrictions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
        >
          <h2 className="text-lg font-bold text-gray-900 mb-4">Active Restrictions</h2>
          <div className="space-y-2">
            {intelligence.adminControls.restrictions.map((restriction, index) => (
              <div key={index} className="border border-gray-200 rounded-xl p-3 bg-amber-50">
                <p className="text-sm text-gray-900">{restriction}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Tags */}
      {intelligence.adminControls.tags.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
        >
          <h2 className="text-lg font-bold text-gray-900 mb-4">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {intelligence.adminControls.tags.map((tag) => (
              <Badge key={tag} tone="info">{tag}</Badge>
            ))}
          </div>
        </motion.div>
      )}

      {/* Notes */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Admin Notes</h2>
          <button
            onClick={() => setShowAddNote(true)}
            className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all"
          >
            + Add Note
          </button>
        </div>
        <div className="space-y-3">
          {intelligence.adminControls.notes.map((note) => (
            <div key={note.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">{note.author}</span>
                <div className="flex items-center gap-2">
                  {note.modifiedAt && (
                    <span className="text-xs text-gray-500">Modified {new Date(note.modifiedAt).toLocaleDateString()}</span>
                  )}
                  <span className="text-xs text-gray-500">{new Date(note.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <p className="text-sm text-gray-700">{note.content}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// Documents Tab Component
function DocumentsTab({ intelligence, isAdmin }: { intelligence: VendorIntelligence; isAdmin: boolean }) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Document Repository</h2>
          {isAdmin && (
            <button className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all">
              + Upload Document
            </button>
          )}
        </div>
        <div className="space-y-3">
          {intelligence.documents.map((doc) => (
            <div key={doc.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{doc.name}</h3>
                    <p className="text-xs text-gray-500">
                      {doc.type} • {formatFileSize(doc.size)} • Uploaded by {doc.uploadedBy} on {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                  Download →
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// Compliance Tab Component
function ComplianceTab({ intelligence }: { intelligence: VendorIntelligence }) {
  return (
    <div className="space-y-6">
      {/* KYC Status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">KYC & Verification</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">KYC Status</span>
              <Badge tone={intelligence.compliance.kycStatus === "verified" ? "success" : "warning"}>
                {intelligence.compliance.kycStatus.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-gray-500">Expires: {new Date(intelligence.compliance.kycExpiry).toLocaleDateString()}</p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Sanctions Check</span>
              <Badge tone={intelligence.compliance.sanctionsCheck === "clear" ? "success" : "danger"}>
                {intelligence.compliance.sanctionsCheck.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-gray-500">Last checked: {new Date(intelligence.compliance.lastSanctionsCheck).toLocaleDateString()}</p>
          </div>
        </div>
      </motion.div>

      {/* Certifications */}
      {intelligence.compliance.certifications.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
        >
          <h2 className="text-lg font-bold text-gray-900 mb-4">Certifications</h2>
          <div className="space-y-3">
            {intelligence.compliance.certifications.map((cert, index) => (
              <div key={index} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{cert.type}</h3>
                  <Badge tone={cert.status === "valid" ? "success" : "warning"}>
                    {cert.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-1">Issued by: {cert.issuer}</p>
                <p className="text-xs text-gray-500">Expires: {new Date(cert.expiry).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Audit Trail Tab Component
function AuditTrailTab({ intelligence }: { intelligence: VendorIntelligence }) {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white overflow-hidden"
      >
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-base font-bold text-gray-900">Complete Audit Trail</h2>
          <p className="text-xs text-gray-500 mt-0.5">All actions and modifications are cryptographically signed</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-900 to-gray-800">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Actor</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Details</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {intelligence.auditTrail.map((entry, index) => (
                <motion.tr
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <Badge tone="info">{entry.action.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{entry.actor}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <pre className="text-xs font-mono bg-gray-50 p-2 rounded">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">{entry.ipAddress || "N/A"}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
