/**
 * Login Page
 * 
 * Allows users to log in to WIRE
 */

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { wireApi } from "../api/client";
import { useToast } from "../../crm/ui/CrmDesignSystem";
import { useAuth } from "../contexts/AuthContext";
import { useFormValidation } from "../hooks/useFormValidation";
import { WireBrand } from "../ui/WireBrand";

export default function WireLoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshUser, refreshOrganization } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSsoSubmitting, setIsSsoSubmitting] = useState(false);
  const [ssoUnavailable, setSsoUnavailable] = useState(false);
  const prefillEmail = sessionStorage.getItem("wire_prefill_email") || "";
  
  const {
    values: formData,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
  } = useFormValidation(
    {
      email: prefillEmail,
      password: "",
    },
    {
      email: {
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
      const result = await wireApi.login({
        email: formData.email.trim(),
        password: formData.password,
      });
      
      // Store token if provided
      if (result.token) {
        localStorage.setItem("wire_auth_token", result.token);
      }
      sessionStorage.removeItem("wire_prefill_email");
      
      // Refresh user and organization data
      await Promise.all([
        refreshUser(),
        refreshOrganization(),
      ]);

      // If user is coming from a public-intent claim flow, claim now that we have auth.
      const pendingClaimRaw = sessionStorage.getItem("wire_pending_public_intent_claim");
      if (pendingClaimRaw) {
        try {
          const pending = JSON.parse(pendingClaimRaw) as { id: string; claimToken: string };
          if (pending?.id && pending?.claimToken) {
            await wireApi.claimPublicIntent(pending.id, pending.claimToken);
            toast.push({ tone: "success", message: "Public intent claimed into your org" });
          }
        } catch (e) {
          // ignore
        } finally {
          sessionStorage.removeItem("wire_pending_public_intent_claim");
        }
      }
      
      toast.push({
        tone: "success",
        message: "Successfully logged in!",
      });
      
      // Navigate to main app (role-aware default)
      const me = await wireApi.getMe();
      navigate(me.user.role === "ADMIN" ? "/admin" : "/intents", { replace: true });
    } catch (error: any) {
      const errorMessage = error.message || "Failed to log in. Please check your credentials.";
      toast.push({
        tone: "danger",
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSso = async () => {
    setIsSsoSubmitting(true);
    try {
      const res = await wireApi.oidcAuthorize({ returnTo: "/intents" });
      // Redirect the browser to IdP.
      window.location.href = res.authorizationUrl;
    } catch (e: any) {
      // If the backend says OIDC isn't enabled, hide the SSO option to avoid repeated dead-ends.
      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("oidc mode not enabled") || msg.toLowerCase().includes("not enabled")) {
        setSsoUnavailable(true);
      }
      toast.push({
        tone: "danger",
        message: e?.message || "SSO is not available in this environment",
      });
      setIsSsoSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <WireBrand size="lg" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to WIRE</h1>
            <p className="text-gray-600">Sign in to your account</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                placeholder="you@example.com"
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition-all ${
                  errors.email && touched.email
                    ? "border-red-500"
                    : "border-gray-300 focus:border-black"
                }`}
                autoFocus
              />
              {errors.email && touched.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={() => handleBlur("password")}
                placeholder="Enter your password"
                autoComplete="current-password"
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition-all ${
                  errors.password && touched.password
                    ? "border-red-500"
                    : "border-gray-300 focus:border-black"
                }`}
              />
              {errors.password && touched.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div />
              <Link to="/forgot-password" className="text-sm font-semibold text-black hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-black text-white font-semibold py-3 rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {!ssoUnavailable ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleSso}
                disabled={isSsoSubmitting}
                className="w-full border-2 border-black text-black font-semibold py-3 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSsoSubmitting ? "Redirecting..." : "Continue with SSO"}
              </button>
              <p className="mt-2 text-xs text-gray-500">
                If your organization enforces SSO, use this button to sign in via your identity provider.
              </p>
            </div>
          ) : (
            <div className="mt-4 text-xs text-gray-500">
              SSO is not enabled in this environment.
            </div>
          )}

          {/* Signup Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="font-semibold text-black hover:underline"
              >
                Sign up
              </Link>
            </p>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
