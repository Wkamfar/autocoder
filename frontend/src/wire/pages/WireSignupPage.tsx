/**
 * Public Signup Page
 * 
 * Allows new organizations to sign up for WIRE
 */

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { wireApi } from "../api/client";
import { useToast } from "../../crm/ui/CrmDesignSystem";
import { useFormValidation } from "../hooks/useFormValidation";
import { WireBrand } from "../ui/WireBrand";

export default function WireSignupPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState<"form" | "success">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    values: formData,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
  } = useFormValidation(
    {
      organizationName: "",
      adminName: "",
      adminEmail: "",
      password: "",
    },
    {
      organizationName: {
        required: true,
        minLength: 2,
        maxLength: 200,
      },
      adminName: {
        required: true,
        minLength: 2,
        maxLength: 200,
      },
      adminEmail: {
        required: true,
        email: true,
      },
      password: {
        required: true,
        minLength: 8,
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAll()) {
      toast.push({
        tone: "warning",
        message: "Please fix the errors in the form",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const res = await wireApi.signup({
        organizationName: formData.organizationName.trim(),
        adminName: formData.adminName.trim(),
        adminEmail: formData.adminEmail.trim(),
        password: formData.password,
      });
      
      toast.push({
        tone: "success",
        message:
          res.emailDelivery?.delivered
            ? "Organization created. Check your inbox for a secure one‑time sign‑in link."
            : "Organization created. You can sign in now.",
      });

      // Prefill login email to avoid copy/paste and reduce failed login retries.
      sessionStorage.setItem("wire_prefill_email", formData.adminEmail.trim());
      
      setStep("success");
    } catch (error: any) {
      const errorMessage = error.message || "Failed to create organization";
      // If the email already exists, this is most likely a "you already have an account" situation.
      // Route them to login with the email prefilled to avoid retry loops (and rate limiting).
      if (typeof errorMessage === "string" && errorMessage.toLowerCase().includes("already exists")) {
        sessionStorage.setItem("wire_prefill_email", formData.adminEmail.trim());
        toast.push({
          tone: "warning",
          message: "An account with this email already exists. Please sign in.",
        });
        navigate("/login");
        return;
      }
      toast.push({
        tone: "danger",
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full border-2 border-black rounded-2xl bg-white p-8 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to WIRE!</h1>
          <p className="text-gray-600 mb-6">
            Your organization is ready. We sent a secure one‑time sign‑in link to{" "}
            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{formData.adminEmail}</span>.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="w-full px-6 py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-all"
          >
            Go to sign in
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <WireBrand size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sign up for WIRE</h1>
          <p className="text-gray-600">Create your organization and start securing wire transfers</p>
        </div>

          {/* Signup Link */}
          <div className="mb-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-black hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Signup Form */}
        <div className="border-2 border-black rounded-2xl bg-white p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Organization Name
              </label>
              <input
                type="text"
                value={formData.organizationName}
                onChange={(e) => handleChange("organizationName", e.target.value)}
                onBlur={() => handleBlur("organizationName")}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 ${
                  touched.organizationName && errors.organizationName ? "border-red-500" : "border-black"
                }`}
                placeholder="Acme Corporation"
                disabled={isSubmitting}
              />
              {touched.organizationName && errors.organizationName && (
                <p className="mt-1 text-sm text-red-600">{errors.organizationName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={formData.adminName}
                onChange={(e) => handleChange("adminName", e.target.value)}
                onBlur={() => handleBlur("adminName")}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 ${
                  touched.adminName && errors.adminName ? "border-red-500" : "border-black"
                }`}
                placeholder="John Doe"
                disabled={isSubmitting}
              />
              {touched.adminName && errors.adminName && (
                <p className="mt-1 text-sm text-red-600">{errors.adminName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={formData.adminEmail}
                onChange={(e) => handleChange("adminEmail", e.target.value)}
                onBlur={() => handleBlur("adminEmail")}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 ${
                  touched.adminEmail && errors.adminEmail ? "border-red-500" : "border-black"
                }`}
                placeholder="john@acme.com"
                disabled={isSubmitting}
              />
              {touched.adminEmail && errors.adminEmail && (
                <p className="mt-1 text-sm text-red-600">{errors.adminEmail}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                This will be your admin account email
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={() => handleBlur("password")}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 ${
                  touched.password && errors.password ? "border-red-500" : "border-black"
                }`}
                placeholder="Create a strong password (min 8 characters)"
                disabled={isSubmitting}
              />
              {touched.password && errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating Organization..." : "Create Organization"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-black font-semibold hover:underline"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div>
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-gray-900">Voice Verification</p>
            <p className="text-xs text-gray-600">Real-time fraud prevention</p>
          </div>
          <div>
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <p className="text-xs text-gray-600">Bank-level encryption</p>
          </div>
          <div>
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-gray-900">Audit Trail</p>
            <p className="text-xs text-gray-600">Complete compliance</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
