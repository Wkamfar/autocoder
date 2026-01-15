import React, { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "../../crm/ui/CrmDesignSystem";

export default function WireSettingsAdvancedPage() {
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [language, setLanguage] = useState("en-US");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [exportFormat, setExportFormat] = useState("json");

  return (
    <div className="space-y-6">
      {/* Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-6"
      >
        <h3 className="text-base font-bold text-gray-900 mb-6">Preferences</h3>
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
            >
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="es-ES">Spanish</option>
              <option value="fr-FR">French</option>
              <option value="de-DE">German</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Date Format
            </label>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <button className="px-6 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all">
              Save Preferences
            </button>
          </div>
        </div>
      </motion.div>

      {/* Data Export */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-6"
      >
        <h3 className="text-base font-bold text-gray-900 mb-6">Data Export</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Export Format
            </label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (XLSX)</option>
            </select>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-800 mb-3">
              Export all your data including intents, requests, beneficiaries, and audit logs.
            </p>
            <button className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all">
              Export Data
            </button>
          </div>
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-red-500 rounded-2xl bg-red-50 p-6"
      >
        <h3 className="text-base font-bold text-red-900 mb-6">Danger Zone</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white border-2 border-red-200 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-gray-900">Delete Account</p>
              <p className="text-xs text-gray-600 mt-1">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <button className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-all">
              Delete Account
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
