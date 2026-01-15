import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { Badge } from "../../crm/ui/CrmDesignSystem";

export default function WireSettingsOverviewPage() {
  const { user, organization } = useAuth();
  const navigate = useNavigate();
  
  if (!user) {
    return (
      <div className="space-y-6">
        <div className="border-2 border-gray-200 rounded-2xl bg-white p-6">
          <p className="text-gray-600">Loading user information...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm sm:text-sm font-semibold text-gray-900">Account Status</h3>
            <Badge tone="success" className="text-xs">Active</Badge>
          </div>
          <p className="text-xs sm:text-xs text-gray-600">Your account is active and verified</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm sm:text-sm font-semibold text-gray-900">Role</h3>
            <Badge tone="info" className="text-xs">{user.role}</Badge>
          </div>
          <p className="text-xs sm:text-xs text-gray-600">{user.permissions?.length || 0} permissions</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm sm:text-sm font-semibold text-gray-900">Last Login</h3>
          </div>
          <p className="text-xs sm:text-xs text-gray-600">Today at 9:42 AM</p>
        </motion.div>
      </div>

      {/* Account Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h3 className="text-base font-bold text-gray-900 mb-4">Account Summary</h3>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-gray-100 gap-2 sm:gap-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm sm:text-sm font-medium text-gray-900">Email</p>
              <p className="text-xs sm:text-xs text-gray-600 mt-0.5 break-all">{user.email}</p>
            </div>
            <Badge tone="success" className="text-xs self-start sm:self-center">Verified</Badge>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-gray-100 gap-2 sm:gap-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm sm:text-sm font-medium text-gray-900">Name</p>
              <p className="text-xs sm:text-xs text-gray-600 mt-0.5">{user.name}</p>
            </div>
            <button className="text-xs sm:text-xs text-gray-600 hover:text-gray-900 min-h-[44px] sm:min-h-0 py-2 sm:py-0 self-start sm:self-center">Edit</button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-2 sm:gap-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm sm:text-sm font-medium text-gray-900">User ID</p>
              <p className="text-xs sm:text-xs text-gray-600 mt-0.5 font-mono break-all">{user.id}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h3 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/settings/profile")}
            className="text-left p-4 border-2 border-gray-200 rounded-xl hover:border-black hover:bg-gray-50 transition-all min-h-[44px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-sm font-semibold text-gray-900">Update Profile</p>
                <p className="text-xs sm:text-xs text-gray-600">Change your name and email</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => navigate("/settings/security")}
            className="text-left p-4 border-2 border-gray-200 rounded-xl hover:border-black hover:bg-gray-50 transition-all min-h-[44px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-sm font-semibold text-gray-900">Security Settings</p>
                <p className="text-xs sm:text-xs text-gray-600">Manage password and 2FA</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => navigate("/settings/accounts")}
            className="text-left p-4 border-2 border-gray-200 rounded-xl hover:border-black hover:bg-gray-50 transition-all min-h-[44px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-sm font-semibold text-gray-900">Bank Accounts</p>
                <p className="text-xs sm:text-xs text-gray-600">Connect and manage accounts</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => navigate("/settings/api-keys")}
            className="text-left p-4 border-2 border-gray-200 rounded-xl hover:border-black hover:bg-gray-50 transition-all min-h-[44px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-sm font-semibold text-gray-900">API Keys</p>
                <p className="text-xs sm:text-xs text-gray-600">Manage your API access</p>
              </div>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
