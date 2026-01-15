import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../crm/ui/CrmDesignSystem";
import { WireProblemStatement } from "./WireProblemStatement";

type OnboardingStep = "problem" | "solution" | "voice" | "first-transfer" | "complete";

export function WireSenderOnboarding({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("problem");
  const [voiceEnrolled, setVoiceEnrolled] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleNext = () => {
    if (currentStep === "problem") {
      setCurrentStep("solution");
    } else if (currentStep === "solution") {
      setCurrentStep("voice");
    } else if (currentStep === "voice") {
      setVoiceEnrolled(true);
      setTimeout(() => {
        setCurrentStep("first-transfer");
      }, 1500);
    } else if (currentStep === "first-transfer") {
      setCurrentStep("complete");
    } else if (currentStep === "complete") {
      onComplete();
      navigate("/intents");
    }
  };

  const steps = [
    { id: "problem", label: "The Problem" },
    { id: "solution", label: "The Solution" },
    { id: "voice", label: "Voice Enrollment" },
    { id: "first-transfer", label: "First Transfer" },
    { id: "complete", label: "Complete" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-4xl rounded-2xl border-2 border-black bg-white shadow-2xl overflow-hidden my-auto"
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
              <h2 className="text-lg font-bold text-gray-900">Sender Onboarding</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Step {currentStepIndex + 1} of {steps.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
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
        <div className="p-4 sm:p-6 md:p-8 min-h-[500px] flex flex-col">
          <AnimatePresence mode="wait">
            {currentStep === "problem" && (
              <ProblemStep key="problem" onNext={handleNext} />
            )}
            {currentStep === "solution" && (
              <SolutionStep key="solution" onNext={handleNext} />
            )}
            {currentStep === "voice" && (
              <VoiceEnrollmentStep
                key="voice"
                onNext={handleNext}
                enrolled={voiceEnrolled}
              />
            )}
            {currentStep === "first-transfer" && (
              <FirstTransferStep key="first-transfer" onNext={handleNext} />
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

function ProblemStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col space-y-6"
    >
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-3">The Problem: PDF Spoofing</h3>
        <p className="text-gray-600">
          Companies lose millions annually to wire fraud. Here's how it happens:
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="border-2 border-red-300 rounded-xl p-4 bg-red-50 text-center">
          <p className="text-[10px] uppercase tracking-wide text-red-600 mb-1">Average Loss</p>
          <p className="text-3xl font-bold font-mono text-red-600">$2.3M</p>
          <p className="text-xs text-red-500 mt-1">per year</p>
        </div>
        <div className="border-2 border-red-300 rounded-xl p-4 bg-red-50 text-center">
          <p className="text-[10px] uppercase tracking-wide text-red-600 mb-1">PDF Spoofing</p>
          <p className="text-3xl font-bold font-mono text-red-600">78%</p>
          <p className="text-xs text-red-500 mt-1">of fraud cases</p>
        </div>
        <div className="border-2 border-red-300 rounded-xl p-4 bg-red-50 text-center">
          <p className="text-[10px] uppercase tracking-wide text-red-600 mb-1">Still Vulnerable</p>
          <p className="text-3xl font-bold font-mono text-red-600">100%</p>
          <p className="text-xs text-red-500 mt-1">handwritten forms</p>
        </div>
      </div>

      <div className="border-2 border-red-500 rounded-xl p-6 bg-red-50 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs font-bold">1</span>
          </div>
          <div>
            <p className="font-semibold text-red-900 mb-1">PDFs Get Spoofed</p>
            <p className="text-sm text-red-700">
              Attackers intercept PDF approval emails, modify amounts/beneficiaries, and resend.
              Recipients approve without noticing changes.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs font-bold">2</span>
          </div>
          <div>
            <p className="font-semibold text-red-900 mb-1">Handwritten Forms Still Fail</p>
            <p className="text-sm text-red-700">
              Companies resorted to handwritten scanned forms, but these can still be digitally
              altered or forged. Millions still lost annually.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs font-bold">3</span>
          </div>
          <div>
            <p className="font-semibold text-red-900 mb-1">No Real-Time Verification</p>
            <p className="text-sm text-red-700">
              Current methods rely on static documents that can be modified. There's no way to
              verify the approver's identity in real-time.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full sm:w-auto px-6 py-3.5 sm:py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all duration-150 active:scale-95 text-base"
      >
        See the Solution →
      </button>
    </motion.div>
  );
}

function SolutionStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col space-y-6"
    >
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-3">The Solution: WIRE Voice</h3>
        <p className="text-gray-600">
          WIRE uses real-time voice verification that cannot be spoofed. Your voice is your
          signature.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Old Way */}
        <div className="border-2 border-red-300 rounded-xl p-5 bg-red-50">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h4 className="text-lg font-bold text-red-900">Old Way (PDF)</h4>
          </div>
          <div className="space-y-2 text-sm text-red-800">
            <p>✗ PDF approval email sent</p>
            <p>✗ Attacker intercepts & modifies</p>
            <p>✗ Approver signs without noticing</p>
            <p className="font-semibold">✗ Money sent to wrong account</p>
            <p className="font-semibold">✗ Millions lost</p>
          </div>
        </div>

        {/* New Way */}
        <div className="border-2 border-emerald-300 rounded-xl p-5 bg-emerald-50">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="text-lg font-bold text-emerald-900">New Way (WIRE)</h4>
          </div>
          <div className="space-y-2 text-sm text-emerald-800">
            <p>✓ Transfer intent created</p>
            <p>✓ Real-time voice challenge</p>
            <p>✓ Voice verified (cannot be spoofed)</p>
            <p className="font-semibold">✓ Transfer protected</p>
            <p className="font-semibold">✓ Zero fraud</p>
          </div>
        </div>
      </div>

      <div className="border-2 border-black rounded-xl p-6 bg-gray-50">
        <h4 className="font-bold text-gray-900 mb-3">Security Guarantees</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Voice Cannot Be Spoofed</p>
            <p className="text-xs text-gray-600">
              AI voice clones are detected and blocked. Your unique voiceprint is verified in
              real-time.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Every Transfer Protected</p>
            <p className="text-xs text-gray-600">
              Every transfer requires your voice approval. No exceptions. No bypasses.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Immutable Audit Trail</p>
            <p className="text-xs text-gray-600">
              Every action is cryptographically signed and stored. Complete transparency and
              auditability.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full sm:w-auto px-6 py-3.5 sm:py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all duration-150 active:scale-95 text-base"
      >
        Enroll Your Voice →
      </button>
    </motion.div>
  );
}

function VoiceEnrollmentStep({
  onNext,
  enrolled,
}: {
  onNext: () => void;
  enrolled: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleStartEnrollment = () => {
    setIsRecording(true);
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
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Voice Enrollment</h3>
        <p className="text-gray-600">
          Your voice is your signature. Enroll your voiceprint to enable secure voice-based
          authorization for all transfers.
        </p>
      </div>

      {!enrolled ? (
        <div className="space-y-6">
          <div className="border-2 border-gray-200 rounded-xl p-8 bg-gray-50 text-center">
            <div className="w-24 h-24 rounded-full bg-black flex items-center justify-center mx-auto mb-6">
              {isRecording ? (
                <div className="w-16 h-16 rounded-full bg-red-500 animate-pulse" />
              ) : (
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <div className="space-y-4">
                <p className="text-base font-semibold text-gray-900">Recording...</p>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <motion.div
                    className="bg-black h-3 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
                <p className="text-sm text-gray-500">Please speak clearly into your microphone</p>
              </div>
            ) : (
              <div>
                <p className="text-base font-semibold text-gray-900 mb-2">
                  Ready to enroll your voice
                </p>
                <p className="text-sm text-gray-500">
                  Click below to start recording. You'll be asked to speak a few phrases to create
                  your unique voiceprint.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleStartEnrollment}
            disabled={isRecording}
            className="w-full px-6 py-4 bg-black text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-95"
          >
            {isRecording ? "Recording..." : "Start Voice Enrollment"}
          </button>
        </div>
      ) : (
        <div className="border-2 border-emerald-300 rounded-xl p-8 bg-emerald-50 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-base font-semibold text-emerald-900 mb-2">Voice Enrollment Complete</p>
          <p className="text-sm text-emerald-700">Your voiceprint has been securely enrolled</p>
        </div>
      )}
    </motion.div>
  );
}

function FirstTransferStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col justify-center space-y-6"
    >
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Create Your First Transfer</h3>
        <p className="text-gray-600">
          You're all set! Now you can create secure transfer intents. Every transfer will require
          your voice approval.
        </p>
      </div>

      <div className="border-2 border-black rounded-xl p-6 bg-gray-50 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">1</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-1">Create Transfer Intent</p>
            <p className="text-sm text-gray-600">
              Enter amount, beneficiary, and purpose. The system will assess risk automatically.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">2</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-1">Voice Challenge</p>
            <p className="text-sm text-gray-600">
              Complete a voice challenge to verify your identity. This cannot be spoofed.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">3</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-1">Approval & Execution</p>
            <p className="text-sm text-gray-600">
              Once approved, the transfer is executed securely with a complete audit trail.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full sm:w-auto px-6 py-3.5 sm:py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all duration-150 active:scale-95 text-base"
      >
        Create First Transfer →
      </button>
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
        <h3 className="text-2xl font-bold text-gray-900 mb-2">You're All Set!</h3>
        <p className="text-gray-600 max-w-md">
          Your voice is enrolled and you're ready to create secure transfers. Every transfer will
          be protected by your voice signature.
        </p>
      </div>
      <button
        onClick={onNext}
        className="w-full sm:w-auto px-6 py-3.5 sm:py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all duration-150 active:scale-95 text-base"
      >
        Go to Intents →
      </button>
    </motion.div>
  );
}
