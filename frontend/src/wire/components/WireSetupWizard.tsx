import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../crm/ui/CrmDesignSystem";
import { wireApi } from "../api/client";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { WireBrand } from "../ui/WireBrand";

type SetupStep = "welcome" | "organization" | "admin" | "voice" | "complete";

export function WireSetupWizard({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState<SetupStep>("welcome");
  const [orgName, setOrgName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [voiceEnrolled, setVoiceEnrolled] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const { user, organization, refreshUser, refreshOrganization } = useAuth();

  // If the user is already onboarded to an org, skip org creation step.
  useEffect(() => {
    if (organization && currentStep === "welcome") {
      setCurrentStep("voice");
    }
  }, [organization, currentStep]);
  
  const createOrgMutation = useMutation({
    mutationFn: async (data: { name: string; adminName: string; adminEmail: string }) => {
      // Use public signup endpoint if no org exists, otherwise create org
      return wireApi.signup({
        organizationName: data.name,
        adminName: data.adminName,
        adminEmail: data.adminEmail,
      });
    },
    onSuccess: () => {
      // Refresh auth to get new org/user
      Promise.all([refreshUser(), refreshOrganization()]).catch(() => {});
      setCurrentStep("voice");
      toast.push({
        tone: "success",
        message: "Organization created successfully",
      });
    },
    onError: (error: any) => {
      toast.push({
        tone: "danger",
        message: error.message || "Failed to create organization",
      });
    },
  });

  const handleNext = () => {
    if (currentStep === "welcome") {
      // If org already exists, jump straight to voice enrollment setup
      if (organization) {
        setCurrentStep("voice");
      } else {
        setCurrentStep("organization");
      }
    } else if (currentStep === "organization") {
      if (!orgName.trim() || !adminName.trim() || !adminEmail.trim()) {
        toast.push({
          tone: "warning",
          message: "Please fill in all fields",
        });
        return;
      }
      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) {
        toast.push({
          tone: "warning",
          message: "Please enter a valid email address",
        });
        return;
      }
      createOrgMutation.mutate({
        name: orgName.trim(),
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
      });
    } else if (currentStep === "voice") {
      setVoiceEnrolled(true);
      setTimeout(() => {
        setCurrentStep("complete");
      }, 1500);
    } else if (currentStep === "complete") {
      localStorage.setItem("wire_setup_complete", "true");
      onComplete();
      navigate("/admin");
    }
  };

  const handleClose = () => {
    // Allow users to defer onboarding without being blocked.
    localStorage.setItem("wire_setup_complete", "true");
    onComplete();
  };

  const handleSkip = () => {
    if (currentStep === "voice") {
      setCurrentStep("complete");
    }
  };

  const steps = [
    { id: "welcome", label: "Welcome" },
    { id: "organization", label: "Organization" },
    { id: "voice", label: "Voice" },
    { id: "complete", label: "Complete" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl rounded-2xl border-2 border-black bg-white shadow-2xl overflow-hidden my-auto"
      >
        {/* Progress Bar */}
        <div className="h-1 bg-gray-100">
          <motion.div
            className="h-full bg-black"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Header */}
        <header className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">WIRE Setup</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Step {currentStepIndex + 1} of {steps.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClose}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Do this later
              </button>
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index <= currentStepIndex ? "bg-black" : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 sm:p-6 md:p-8 min-h-[400px] flex flex-col">
          <AnimatePresence mode="wait">
            {currentStep === "welcome" && (
              <WelcomeStep key="welcome" onNext={handleNext} />
            )}
            {currentStep === "organization" && (
              <OrganizationStep
                key="organization"
                orgName={orgName}
                setOrgName={setOrgName}
                adminName={adminName}
                setAdminName={setAdminName}
                adminEmail={adminEmail}
                setAdminEmail={setAdminEmail}
                onNext={handleNext}
                isLoading={createOrgMutation.isPending}
              />
            )}
            {currentStep === "voice" && (
              <VoiceEnrollmentStep
                key="voice"
                onNext={handleNext}
                onSkip={handleSkip}
                enrolled={voiceEnrolled}
              />
            )}
            {currentStep === "complete" && (
              <CompleteStep key="complete" onNext={handleNext} />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
    >
      <WireBrand size="lg" className="justify-center" />
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Welcome to WIRE</h3>
        <p className="text-gray-600 max-w-md">
          Voice-based authorization for enterprise treasury teams. Prevent wire fraud with
          real-time voice verification that cannot be spoofed.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-md">
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center mb-2 mx-auto">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <p className="text-xs font-semibold text-gray-900">Secure</p>
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center mb-2 mx-auto">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-gray-900">Verified</p>
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center mb-2 mx-auto">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-gray-900">Auditable</p>
        </div>
      </div>
      <button
        onClick={onNext}
        className="w-full sm:w-auto px-6 py-3.5 sm:py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all duration-150 active:scale-95 text-base"
      >
        Get Started
      </button>
    </motion.div>
  );
}

function OrganizationStep({
  orgName,
  setOrgName,
  adminName,
  setAdminName,
  adminEmail,
  setAdminEmail,
  onNext,
  isLoading,
}: {
  orgName: string;
  setOrgName: (name: string) => void;
  adminName: string;
  setAdminName: (name: string) => void;
  adminEmail: string;
  setAdminEmail: (email: string) => void;
  onNext: () => void;
  isLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col justify-center space-y-6"
    >
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Organization Setup</h3>
        <p className="text-sm text-gray-600">
          Enter your organization name and admin account details. This will create your organization and first admin user.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Organization Name
          </label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Corporation"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Admin Name</label>
          <input
            type="text"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Admin Email</label>
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="john@acme.com"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
          />
        </div>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onNext}
          disabled={isLoading || !orgName.trim() || !adminName.trim() || !adminEmail.trim()}
          className="w-full px-6 py-3.5 sm:py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-95 text-base"
        >
          {isLoading ? "Creating..." : "Create Organization"}
        </button>
      </div>
    </motion.div>
  );
}


function VoiceEnrollmentStep({
  onNext,
  onSkip,
  enrolled,
}: {
  onNext: () => void;
  onSkip: () => void;
  enrolled: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleStartEnrollment = () => {
    setIsRecording(true);
    // Simulate enrollment progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsRecording(false);
          setTimeout(() => {
            onNext();
          }, 500);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col justify-center space-y-6"
    >
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Voice Enrollment</h3>
        <p className="text-sm text-gray-600">
          Your voice is your signature. Enroll your voiceprint to enable secure voice-based
          authorization for all transfers.
        </p>
      </div>

      {!enrolled ? (
        <div className="space-y-6">
          <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50 text-center">
            <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center mx-auto mb-4">
              {isRecording ? (
                <div className="w-12 h-12 rounded-full bg-red-500 animate-pulse" />
              ) : (
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              )}
            </div>
            {isRecording ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-900">Recording...</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    className="bg-black h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
                <p className="text-xs text-gray-500">Please speak clearly</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  Ready to enroll your voice
                </p>
                <p className="text-xs text-gray-500">
                  Click below to start recording. You'll be asked to speak a few phrases.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleStartEnrollment}
              disabled={isRecording}
              className="flex-1 px-6 py-3.5 sm:py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-95 text-base"
            >
              {isRecording ? "Recording..." : "Start Enrollment"}
            </button>
            <button
              onClick={onSkip}
              className="px-6 py-3.5 sm:py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all duration-150 active:scale-95 text-base"
            >
              Skip
            </button>
          </div>
        </div>
      ) : (
        <div className="border-2 border-emerald-300 rounded-xl p-6 bg-emerald-50 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-emerald-900">Voice Enrollment Complete</p>
        </div>
      )}
    </motion.div>
  );
}

function CompleteStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
    >
      <div className="w-24 h-24 rounded-2xl bg-emerald-500 flex items-center justify-center">
        <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Setup Complete!</h3>
        <p className="text-gray-600 max-w-md">
          Your WIRE organization is ready. You can now invite team members and start creating
          secure transfer intents.
        </p>
      </div>
      <button
        onClick={onNext}
        className="w-full sm:w-auto px-6 py-3.5 sm:py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all duration-150 active:scale-95 text-base"
      >
        Go to Dashboard
      </button>
    </motion.div>
  );
}
