/**
 * Beneficiary Confirmation Page - Public, No Login Required
 * Route: /v2/beneficiaries/confirm?token=...
 * 
 * Allows beneficiaries to confirm their account by:
 * 1. Entering account details (routing, account number, bank name)
 * 2. Recording voice proof
 * 3. Submitting confirmation
 */
import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "../../crm/ui/CrmDesignSystem";
import { useWavRecorder } from "../hooks/useWavRecorder";
import { wireApi } from "../api/client";
import { getApiBaseUrl } from "../api/config";
import { WireBrand } from "../ui/WireBrand";

type Step = "loading" | "details" | "voice" | "success" | "error";

export default function WireBeneficiaryConfirmPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recorder = useWavRecorder();
  
  const [step, setStep] = useState<Step>("loading");
  const [beneficiary, setBeneficiary] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [form, setForm] = useState({
    accountNumber: "",
    routingNumber: "",
    bankName: "",
  });

  // Load beneficiary info from token
  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStep("error");
      return;
    }

    async function loadBeneficiary() {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/beneficiaries/confirm?token=${encodeURIComponent(token)}`);
        if (!response.ok) {
          throw new Error("Invalid or expired confirmation token");
        }
        const data = await response.json();
        setBeneficiary(data);
        setStep("details");
      } catch (err: any) {
        toast.push({ tone: "danger", message: err.message || "Failed to load beneficiary information" });
        setStep("error");
      }
    }

    loadBeneficiary();
  }, [searchParams, toast]);

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.accountNumber || !form.routingNumber || !form.bankName) {
      toast.push({ tone: "danger", message: "Please fill all required fields" });
      return;
    }
    setStep("voice");
  };

  const handleVoiceRecord = async () => {
    try {
      setIsRecording(true);
      await recorder.start();
    } catch (err: any) {
      toast.push({ tone: "danger", message: err.message || "Failed to start recording" });
      setIsRecording(false);
    }
  };

  const handleVoiceStop = async () => {
    try {
      const { wav } = await recorder.stop();
      setIsRecording(false);
      
      // Convert blob to base64 for submission
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = (reader.result as string).split(",")[1];
        handleSubmit(base64Audio);
      };
      reader.readAsDataURL(wav);
    } catch (err: any) {
      toast.push({ tone: "danger", message: err.message || "Failed to stop recording" });
      setIsRecording(false);
    }
  };

  const handleSubmit = async (audioBase64?: string) => {
    const token = searchParams.get("token");
    if (!token) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/beneficiaries/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          accountNumber: form.accountNumber,
          routingNumber: form.routingNumber,
          bankName: form.bankName,
          audio: audioBase64,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to confirm beneficiary");
      }

      const result = await response.json();
      setStep("success");
      toast.push({ tone: "success", message: "Beneficiary confirmed successfully!" });
    } catch (err: any) {
      toast.push({ tone: "danger", message: err.message || "Failed to confirm beneficiary" });
      setIsSubmitting(false);
    }
  };

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <WireBrand />
          </div>
          <h1 className="text-2xl font-bold mb-4">Invalid Confirmation Link</h1>
          <p className="text-gray-600 mb-6">
            This confirmation link is invalid or has expired. Please contact the sender to request a new confirmation email.
          </p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          <div className="mb-6">
            <WireBrand />
          </div>
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Confirmation Successful!</h1>
            <p className="text-gray-600">
              Your beneficiary account has been confirmed. You can now receive wire transfers.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <WireBrand />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-black rounded-2xl bg-white overflow-hidden"
        >
          <header className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
            <h1 className="text-xl font-bold text-gray-900">Confirm Your Beneficiary Account</h1>
            <p className="text-sm text-gray-600 mt-1">
              {beneficiary?.displayName ? `Confirming account for ${beneficiary.displayName}` : "Complete your account setup"}
            </p>
          </header>

          <div className="p-6">
            {step === "details" && (
              <form onSubmit={handleDetailsSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={form.accountNumber}
                    onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, "") })}
                    placeholder="Enter your account number"
                    className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
                    required
                    maxLength={17}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Routing Number
                  </label>
                  <input
                    type="text"
                    value={form.routingNumber}
                    onChange={(e) => setForm({ ...form, routingNumber: e.target.value.replace(/\D/g, "") })}
                    placeholder="Enter your routing number"
                    className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
                    required
                    maxLength={20}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    placeholder="Enter your bank name"
                    className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
                    required
                    maxLength={200}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all"
                  >
                    Continue to Voice Proof
                  </button>
                </div>
              </form>
            )}

            {step === "voice" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Voice Verification</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Please record a voice sample to verify your identity. This helps secure your account.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-6 text-center">
                  {!isRecording ? (
                    <div>
                      <button
                        onClick={handleVoiceRecord}
                        disabled={isSubmitting}
                        className="px-8 py-4 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50"
                      >
                        Start Recording
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-4">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                          <div className="w-8 h-8 bg-red-600 rounded-full"></div>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-2">Recording...</p>
                        <p className="text-xs text-gray-600">Speak clearly into your microphone</p>
                      </div>
                      <button
                        onClick={handleVoiceStop}
                        disabled={isSubmitting}
                        className="px-8 py-4 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-all disabled:opacity-50"
                      >
                        Stop Recording & Submit
                      </button>
                    </div>
                  )}
                </div>

                {recorder.error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm text-red-600">{recorder.error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setStep("details")}
                    disabled={isSubmitting || isRecording}
                    className="px-6 py-3 border-2 border-black rounded-xl text-sm font-medium hover:bg-gray-50 transition-all disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => handleSubmit()}
                    disabled={isSubmitting || isRecording}
                    className="flex-1 px-6 py-3 bg-gray-600 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-all disabled:opacity-50"
                  >
                    Skip Voice Proof
                  </button>
                </div>
              </div>
            )}

            {isSubmitting && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">Submitting confirmation...</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
