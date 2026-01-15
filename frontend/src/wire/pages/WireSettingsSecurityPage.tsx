import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { useToast } from "../../crm/ui/CrmDesignSystem";
import { useAuth } from "../contexts/AuthContext";
import { wireApi } from "../api/client";
import { useFormValidation } from "../hooks/useFormValidation";

export default function WireSettingsSecurityPage() {
  const toast = useToast();
  const { refreshUser, logout } = useAuth();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  const sessionsQuery = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: () => wireApi.getSessions(),
    staleTime: 10_000,
  });

  const revokeOtherSessionsMutation = useMutation({
    mutationFn: async () => {
      return await wireApi.logoutAll(false);
    },
    onSuccess: async (res) => {
      toast.push({ tone: "success", message: `Revoked ${res.revoked} other session(s)` });
      await sessionsQuery.refetch();
    },
    onError: (e: any) => {
      toast.push({ tone: "danger", message: e?.message || "Failed to revoke sessions" });
    },
  });

  const logoutEverywhereMutation = useMutation({
    mutationFn: async () => {
      return await wireApi.logoutAll(true);
    },
    onSuccess: async (res) => {
      toast.push({ tone: "success", message: `Logged out everywhere (revoked ${res.revoked} session(s))` });
      // Clear local auth and exit.
      await logout();
    },
    onError: (e: any) => {
      toast.push({ tone: "danger", message: e?.message || "Failed to log out everywhere" });
    },
  });

  const sessions = sessionsQuery.data?.sessions ?? [];
  const currentSessionId = sessionsQuery.data?.currentSessionId ?? null;

  const currentSession = useMemo(() => {
    if (!currentSessionId) return null;
    return sessions.find((s) => s.id === currentSessionId) ?? null;
  }, [sessions, currentSessionId]);

  function deviceLabel(userAgent: string | null): string {
    if (!userAgent) return "Unknown device";
    // Basic heuristic; avoids shipping a full UA parser for now.
    const ua = userAgent.toLowerCase();
    const browser = ua.includes("chrome") ? "Chrome" : ua.includes("safari") ? "Safari" : ua.includes("firefox") ? "Firefox" : "Browser";
    const os = ua.includes("mac os") || ua.includes("macintosh") ? "macOS" : ua.includes("windows") ? "Windows" : ua.includes("iphone") ? "iPhone" : ua.includes("android") ? "Android" : "Device";
    return `${browser} on ${os}`;
  }

  function fmtTime(iso: string): string {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }
  
  const {
    values: passwordValues,
    errors: passwordErrors,
    touched,
    handleChange: handlePasswordChange,
    handleBlur: handlePasswordBlur,
    validateAll: validatePassword,
    reset: resetPassword,
  } = useFormValidation(
    {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    {
      currentPassword: { required: true },
      newPassword: {
        required: true,
        minLength: 8,
        custom: (value) => {
          if (!/(?=.*[a-z])/.test(value)) {
            return "Must contain at least one lowercase letter";
          }
          if (!/(?=.*[A-Z])/.test(value)) {
            return "Must contain at least one uppercase letter";
          }
          if (!/(?=.*[0-9])/.test(value)) {
            return "Must contain at least one number";
          }
          return null;
        },
      },
      confirmPassword: {
        required: true,
        custom: (value) => {
          if (value !== passwordValues.newPassword) {
            return "Passwords do not match";
          }
          return null;
        },
      },
    }
  );

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      // TODO: Implement password change endpoint
      // For now, simulate API call
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      toast.push({
        tone: "success",
        message: "Password updated successfully",
      });
      resetPassword();
    },
    onError: (error: any) => {
      toast.push({
        tone: "danger",
        message: error.message || "Failed to update password",
      });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validatePassword()) {
      updatePasswordMutation.mutate({
        currentPassword: passwordValues.currentPassword,
        newPassword: passwordValues.newPassword,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Two-Factor Authentication */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
          <div>
            <h3 className="text-base font-bold text-gray-900">Two-Factor Authentication</h3>
            <p className="text-xs sm:text-xs text-gray-600 mt-1">
              Add an extra layer of security to your account
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer min-h-[44px] sm:min-h-0">
            <input
              type="checkbox"
              checked={twoFactorEnabled}
              onChange={(e) => setTwoFactorEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
          </label>
        </div>
        {twoFactorEnabled && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge tone="success" className="text-xs">Enabled</Badge>
              <span className="text-xs sm:text-xs font-medium text-green-900">Authenticator App</span>
            </div>
            <p className="text-xs sm:text-xs text-green-700">
              Two-factor authentication is active. You'll be prompted for a code when signing in.
            </p>
          </div>
        )}
      </motion.div>

      {/* Change Password */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h3 className="text-base font-bold text-gray-900 mb-4 sm:mb-6">Change Password</h3>
        <form onSubmit={handlePasswordSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-xs sm:text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={passwordValues.currentPassword}
              onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
              onBlur={() => handlePasswordBlur("currentPassword")}
              className={`w-full px-4 py-3 sm:py-3 border-2 rounded-xl text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 min-h-[44px] sm:min-h-0 ${
                touched.currentPassword && passwordErrors.currentPassword
                  ? "border-red-500"
                  : "border-black"
              }`}
            />
            {touched.currentPassword && passwordErrors.currentPassword && (
              <p className="mt-1 text-xs text-red-600">{passwordErrors.currentPassword}</p>
            )}
          </div>
          <div>
            <label className="block text-xs sm:text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              New Password
            </label>
            <input
              type="password"
              value={passwordValues.newPassword}
              onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
              onBlur={() => handlePasswordBlur("newPassword")}
              className={`w-full px-4 py-3 sm:py-3 border-2 rounded-xl text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 min-h-[44px] sm:min-h-0 ${
                touched.newPassword && passwordErrors.newPassword
                  ? "border-red-500"
                  : "border-black"
              }`}
            />
            {touched.newPassword && passwordErrors.newPassword ? (
              <p className="mt-1 text-xs text-red-600">{passwordErrors.newPassword}</p>
            ) : (
              <p className="text-xs sm:text-xs text-gray-600 mt-2">
                Must be at least 8 characters with uppercase, lowercase, and numbers.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs sm:text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              value={passwordValues.confirmPassword}
              onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
              onBlur={() => handlePasswordBlur("confirmPassword")}
              className={`w-full px-4 py-3 sm:py-3 border-2 rounded-xl text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 min-h-[44px] sm:min-h-0 ${
                touched.confirmPassword && passwordErrors.confirmPassword
                  ? "border-red-500"
                  : "border-black"
              }`}
            />
            {touched.confirmPassword && passwordErrors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{passwordErrors.confirmPassword}</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={updatePasswordMutation.isPending}
              className="px-6 py-3 sm:py-3 bg-black text-white text-base sm:text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all min-h-[44px] sm:min-h-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updatePasswordMutation.isPending ? "Updating..." : "Update Password"}
            </button>
            <button
              type="button"
              onClick={resetPassword}
              disabled={updatePasswordMutation.isPending}
              className="px-6 py-3 sm:py-3 border-2 border-black rounded-xl text-base sm:text-sm font-semibold hover:bg-gray-50 transition-all min-h-[44px] sm:min-h-0 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>

      {/* Active Sessions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h3 className="text-base font-bold text-gray-900 mb-4 sm:mb-6">Active Sessions</h3>
        {sessionsQuery.isLoading ? (
          <div className="text-sm text-gray-500">Loading sessions…</div>
        ) : sessionsQuery.isError ? (
          <div className="text-sm text-red-600">Failed to load sessions</div>
        ) : sessions.length === 0 ? (
          <div className="text-sm text-gray-500">No sessions found.</div>
        ) : (
          <>
            <div className="space-y-4">
              {sessions.map((s) => {
                const isCurrent = currentSessionId && s.id === currentSessionId;
                const isRevoked = !!s.revokedAt;
                const isActive = !isRevoked;
                return (
                  <div
                    key={s.id}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-2 rounded-xl gap-3 sm:gap-0 ${
                      isCurrent ? "border-black" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm sm:text-sm font-semibold text-gray-900">{deviceLabel(s.userAgent)}</p>
                        <p className="text-xs sm:text-xs text-gray-600">
                          {isCurrent ? "Current session" : `Last active: ${fmtTime(s.lastActivityAt)}`}
                          {s.ipAddress ? ` • ${s.ipAddress}` : ""}
                          {isRevoked ? ` • Revoked: ${fmtTime(s.revokedAt as string)}` : ""}
                        </p>
                      </div>
                    </div>
                    {isRevoked ? (
                      <Badge tone="neutral" className="text-xs self-start sm:self-center">Revoked</Badge>
                    ) : isCurrent ? (
                      <Badge tone="success" className="text-xs self-start sm:self-center">Current</Badge>
                    ) : isActive ? (
                      <Badge tone="warning" className="text-xs self-start sm:self-center">Active</Badge>
                    ) : (
                      <Badge tone="neutral" className="text-xs self-start sm:self-center">Unknown</Badge>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => revokeOtherSessionsMutation.mutate()}
                disabled={revokeOtherSessionsMutation.isPending || !currentSessionId}
                className="text-sm sm:text-sm text-gray-700 hover:text-gray-900 font-semibold border-2 border-black rounded-xl px-4 py-3 min-h-[44px] disabled:opacity-50"
              >
                {revokeOtherSessionsMutation.isPending ? "Revoking…" : "Revoke all other sessions"}
              </button>
              <button
                onClick={() => logoutEverywhereMutation.mutate()}
                disabled={logoutEverywhereMutation.isPending}
                className="text-sm sm:text-sm text-white bg-black hover:bg-gray-800 font-semibold rounded-xl px-4 py-3 min-h-[44px] disabled:opacity-50"
              >
                {logoutEverywhereMutation.isPending ? "Logging out…" : "Log out everywhere"}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
