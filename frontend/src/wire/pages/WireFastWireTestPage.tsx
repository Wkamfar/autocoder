/**
 * Fast Wire Test Page - Public, No Login Required
 * Route: /v2/test
 * 
 * Allows anyone to create a FAST WIRE with email-based beneficiary
 * User can choose to be a Requestor (initiate) or Approver (receive)
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { useToast } from "../../crm/ui/CrmDesignSystem";
import { wireApi } from "../api/client";
import { useSearchParams } from "react-router-dom";
import { useWavRecorder } from "../hooks/useWavRecorder";

type FastWireRole = "REQUESTOR" | "APPROVER";

interface FastWireForm {
  role: FastWireRole;
  amount: string;
  currency: string;
  purpose: string;
  beneficiaryEmail: string;
  
  // Requestor fields
  requestorEmail: string;
  requestorName: string;
  accountNumber: string;
  routingNumber: string;
  bankName: string;
  
  // Approver fields (optional)
  approvalToken?: string; // If coming from email link
}

export default function WireFastWireTestPage() {
  const toast = useToast();
  const recorder = useWavRecorder();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = useState<"form" | "voice" | "email-verify" | "success">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceProofId, setVoiceProofId] = useState<string | null>(null);
  const [fastWireDetails, setFastWireDetails] = useState<any>(null);
  const [emailVerificationCode, setEmailVerificationCode] = useState("");
  const [form, setForm] = useState<FastWireForm>({
    role: "REQUESTOR",
    amount: "",
    currency: "USD",
    purpose: "",
    beneficiaryEmail: "",
    requestorEmail: "",
    requestorName: "",
    accountNumber: "",
    routingNumber: "",
    bankName: "",
  });
  
  // Check if this is an approval flow (from email token)
  React.useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setForm(prev => ({ ...prev, role: "APPROVER", approvalToken: token }));
      // Load fast wire details from token
      wireApi.getFastWire(token).then((details: any) => {
        setFastWireDetails(details);
        setForm(prev => ({
          ...prev,
          amount: (parseInt(details.amountMinor) / 100).toFixed(2),
          currency: details.currency,
          purpose: details.purpose,
          beneficiaryEmail: details.beneficiaryEmail,
        }));
      }).catch((err: any) => {
        toast.push({ tone: "danger", message: err.message || "Failed to load Fast Wire details" });
      });
    }
  }, [searchParams, toast]);

  const updateForm = (field: keyof FastWireForm, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleRoleSelect = (role: FastWireRole) => {
    updateForm("role", role);
    setStep("form");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (form.role === "REQUESTOR") {
      // Validate requestor fields
      if (!form.requestorEmail || !form.requestorName || !form.accountNumber || !form.routingNumber) {
        toast.push({ tone: "danger", message: "Please fill all required fields" });
        return;
      }
      
      // Move to voice proof step
      setStep("voice");
    } else {
      // Approver flow - submit approval
      await handleApproval();
    }
  };

  const handleStartRecording = async () => {
    try {
      setIsRecording(true);
      await recorder.start();
      toast.push({ tone: "success", message: "Recording started..." });
    } catch (error: any) {
      toast.push({ tone: "danger", message: error.message || "Failed to start recording" });
      setIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    try {
      const { wav } = await recorder.stop();
      setIsRecording(false);
      
      // Submit voice proof
      setIsSubmitting(true);
      try {
        const result = await wireApi.submitFastWireVoiceProof(form.requestorEmail, wav);
        setVoiceProofId(result.voiceProofId);
        toast.push({ tone: "success", message: "Voice proof submitted!" });
        
        // Move to email verification
        setStep("email-verify");
        
        // Send email verification code
        await wireApi.sendEmailVerificationCode(form.requestorEmail);
        toast.push({ tone: "success", message: "Verification email sent!" });
      } catch (error: any) {
        toast.push({ tone: "danger", message: error.message || "Failed to submit voice proof" });
      } finally {
        setIsSubmitting(false);
      }
    } catch (error: any) {
      toast.push({ tone: "danger", message: error.message || "Failed to stop recording" });
      setIsRecording(false);
    }
  };

  const handleEmailVerification = async (code: string) => {
    setIsSubmitting(true);
    try {
      const result = await wireApi.createFastWireRequest({
        role: "REQUESTOR",
        amount: form.amount,
        currency: form.currency,
        purpose: form.purpose,
        beneficiaryEmail: form.beneficiaryEmail,
        requestorEmail: form.requestorEmail,
        requestorName: form.requestorName,
        accountNumber: form.accountNumber,
        routingNumber: form.routingNumber,
        bankName: form.bankName,
        voiceProofId: voiceProofId || undefined,
        emailVerificationCode: code,
      });
      
      toast.push({ tone: "success", message: "Fast Wire request created!" });
      setStep("success");
    } catch (error: any) {
      toast.push({ tone: "danger", message: error.message || "Failed to create Fast Wire" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproval = async () => {
    if (!form.approvalToken) {
      toast.push({ tone: "danger", message: "Missing approval token" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await wireApi.approveFastWire(form.approvalToken, {
        approverEmail: form.beneficiaryEmail, // Approver is the beneficiary
        approverName: form.requestorName, // Could be separate field
        accountNumber: form.accountNumber || undefined,
        routingNumber: form.routingNumber || undefined,
        bankName: form.bankName || undefined,
      });
      
      toast.push({ tone: "success", message: "Fast Wire approved!" });
      setStep("success");
    } catch (error: any) {
      toast.push({ tone: "danger", message: error.message || "Failed to approve Fast Wire" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Role Selection Screen (only show if no role selected yet and no token in URL)
  const urlToken = searchParams.get("token");
  if (!urlToken && !form.role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl border-2 border-black rounded-2xl bg-white p-6 sm:p-8"
        >
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Fast Wire</h1>
            <p className="text-sm text-gray-600">
              Create a fast wire transfer with email-based approval. No login required.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => handleRoleSelect("REQUESTOR")}
              className="w-full p-6 border-2 border-black rounded-xl hover:bg-gray-50 transition-all text-left"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-2">I'm Requesting Money</h2>
              <p className="text-sm text-gray-600">
                Enter your bank details and submit a voice proof. The recipient will approve via email.
              </p>
            </button>

            <button
              onClick={() => handleRoleSelect("APPROVER")}
              className="w-full p-6 border-2 border-black rounded-xl hover:bg-gray-50 transition-all text-left"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-2">I'm Approving a Request</h2>
              <p className="text-sm text-gray-600">
                Approve a Fast Wire request sent to your email. You'll verify via email link.
              </p>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Success Screen
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl border-2 border-emerald-200 rounded-2xl bg-emerald-50 p-6 sm:p-8"
        >
          <div className="text-center">
            <div className="text-6xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-emerald-900 mb-2">
              {form.role === "REQUESTOR" ? "Fast Wire Request Created!" : "Fast Wire Approved!"}
            </h1>
            <p className="text-emerald-800 mb-6">
              {form.role === "REQUESTOR"
                ? "The recipient has been notified by email and will approve via email link."
                : "Both parties have approved. The transaction is being processed on the POSE network."}
            </p>
            <button
              onClick={() => {
                setStep("form");
                setForm({
                  role: "REQUESTOR",
                  amount: "",
                  currency: "USD",
                  purpose: "",
                  beneficiaryEmail: "",
                  requestorEmail: "",
                  requestorName: "",
                  accountNumber: "",
                  routingNumber: "",
                  bankName: "",
                });
              }}
              className="px-6 py-3 border-2 border-emerald-600 rounded-xl font-semibold hover:bg-emerald-100 transition-all"
            >
              Create Another
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Main Form (Requestor or Approver)
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-black rounded-2xl bg-white p-6 sm:p-8"
        >
          <div className="mb-6">
            <button
              onClick={() => setStep("form")}
              className="text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {form.role === "REQUESTOR" ? "Request a Fast Wire" : "Approve Fast Wire"}
            </h1>
            <p className="text-sm text-gray-600">
              {form.role === "REQUESTOR"
                ? "Enter payment details and your bank information"
                : "Review and approve this Fast Wire request"}
            </p>
          </div>

          {/* Approver View (if coming from email link) */}
          {form.role === "APPROVER" && fastWireDetails ? (
            <div className="space-y-6">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <h2 className="text-lg font-bold text-blue-900 mb-2">Fast Wire Request</h2>
                <div className="space-y-2 text-sm text-blue-800">
                  <p><strong>From:</strong> {fastWireDetails.requestorName} ({fastWireDetails.requestorEmail})</p>
                  <p><strong>Amount:</strong> {fastWireDetails.currency} {(parseInt(fastWireDetails.amountMinor) / 100).toFixed(2)}</p>
                  <p><strong>Purpose:</strong> {fastWireDetails.purpose}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Your Bank Details (Optional)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Account Number</label>
                    <input
                      type="text"
                      value={form.accountNumber}
                      onChange={(e) => updateForm("accountNumber", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Routing Number</label>
                    <input
                      type="text"
                      value={form.routingNumber}
                      onChange={(e) => updateForm("routingNumber", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Bank Name</label>
                    <input
                      type="text"
                      value={form.bankName}
                      onChange={(e) => updateForm("bankName", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => window.location.href = "/v2/test"}
                  className="px-6 py-3 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApproval}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Approving..." : "Approve Fast Wire"}
                </button>
              </div>
            </div>
          ) : step === "form" && form.role === "REQUESTOR" ? (
            <form onSubmit={handleFormSubmit} className="space-y-6">
              {/* Amount & Purpose (Both roles) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Amount
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={form.currency}
                      onChange={(e) => updateForm("currency", e.target.value)}
                      className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                    <input
                      type="text"
                      value={form.amount}
                      onChange={(e) => updateForm("amount", e.target.value)}
                      placeholder="0.00"
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Purpose
                  </label>
                  <input
                    type="text"
                    value={form.purpose}
                    onChange={(e) => updateForm("purpose", e.target.value)}
                    placeholder="e.g., Invoice payment"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                    required
                  />
                </div>
              </div>

              {/* Beneficiary Email (Requestor only) */}
              {form.role === "REQUESTOR" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Recipient Email
                    </label>
                    <input
                      type="email"
                      value={form.beneficiaryEmail}
                      onChange={(e) => updateForm("beneficiaryEmail", e.target.value)}
                      placeholder="recipient@example.com"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                      required
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      The recipient will receive an email to approve this Fast Wire
                    </p>
                  </div>

                  {/* Requestor Information */}
                  <div className="border-t border-gray-200 pt-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Your Information</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Your Name
                        </label>
                        <input
                          type="text"
                          value={form.requestorName}
                          onChange={(e) => updateForm("requestorName", e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Your Email
                        </label>
                        <input
                          type="email"
                          value={form.requestorEmail}
                          onChange={(e) => updateForm("requestorEmail", e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bank Account Details (Requestor only) */}
                  <div className="border-t border-gray-200 pt-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Bank Account Details</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Account Number
                        </label>
                        <input
                          type="text"
                          value={form.accountNumber}
                          onChange={(e) => updateForm("accountNumber", e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Routing Number
                        </label>
                        <input
                          type="text"
                          value={form.routingNumber}
                          onChange={(e) => updateForm("routingNumber", e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          value={form.bankName}
                          onChange={(e) => updateForm("bankName", e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                          required
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      This information is encrypted and only used for verification purposes
                    </p>
                  </div>
                </>
              )}

              {/* Submit Button */}
              <div className="flex gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="px-6 py-3 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? "Processing..."
                    : form.role === "REQUESTOR"
                    ? "Continue to Voice Proof"
                    : "Approve Fast Wire"}
                </button>
              </div>
            </form>
          ) : null}

          {/* Voice Proof Step (Requestor only) */}
          {step === "voice" && form.role === "REQUESTOR" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Voice Proof</h2>
                <p className="text-sm text-gray-600">
                  Record a voice sample to verify your identity. This is required for Fast Wire requests.
                </p>
              </div>
              
              <div className="border-2 border-gray-200 rounded-xl p-8 text-center">
                {voiceProofId ? (
                  <div className="space-y-4">
                    <div className="text-green-600 text-2xl mb-2">✓</div>
                    <p className="text-sm font-semibold text-gray-900">Voice proof submitted</p>
                    <p className="text-xs text-gray-600">Proof ID: {voiceProofId}</p>
                  </div>
                ) : isRecording ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center">
                      <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">Recording...</p>
                    <p className="text-xs text-gray-600">Speak clearly for a few seconds</p>
                    <button
                      onClick={handleStopRecording}
                      disabled={isSubmitting}
                      className="px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all disabled:opacity-50"
                    >
                      Stop Recording
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Click the button below to start recording. You'll need to speak for a few seconds.
                    </p>
                    <button
                      onClick={handleStartRecording}
                      disabled={isSubmitting || isRecording}
                      className="px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Processing..." : "Start Recording"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

              {/* Email Verification Step (Requestor only) */}
          {step === "email-verify" && form.role === "REQUESTOR" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Verify Your Email</h2>
                <p className="text-sm text-gray-600">
                  We've sent a verification code to <strong>{form.requestorEmail}</strong>
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={emailVerificationCode}
                  onChange={(e) => setEmailVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                  maxLength={6}
                />
              </div>
              <button
                onClick={() => handleEmailVerification(emailVerificationCode)}
                disabled={isSubmitting || emailVerificationCode.length !== 6}
                className="w-full px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Verifying..." : "Verify & Create Fast Wire"}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
