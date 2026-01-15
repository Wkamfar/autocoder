import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "../../crm/ui/CrmDesignSystem";
import { wireApi } from "../api/client";

export default function WireSettingsNotificationsPage() {
  const toast = useToast();
  const [emailNotifications, setEmailNotifications] = useState({
    paymentApproved: true,
    paymentDenied: true,
    paymentExecuted: true,
    requestReceived: true,
    securityAlerts: true,
    weeklySummary: false,
  });

  const [pushNotifications, setPushNotifications] = useState({
    paymentApproved: true,
    paymentDenied: true,
    paymentExecuted: false,
    requestReceived: true,
  });

  // TODO: Load preferences from backend when endpoint exists
  // const { data: preferences } = useQuery({
  //   queryKey: ["notificationPreferences"],
  //   queryFn: () => wireApi.getNotificationPreferences(),
  // });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (prefs: typeof emailNotifications) => {
      // TODO: Implement notification preferences endpoint
      // For now, simulate API call
      return new Promise((resolve) => setTimeout(resolve, 500));
    },
    onSuccess: () => {
      toast.push({
        tone: "success",
        message: "Notification preferences updated",
      });
    },
    onError: (error: any) => {
      toast.push({
        tone: "danger",
        message: error.message || "Failed to update preferences",
      });
    },
  });

  const handleEmailNotificationChange = (key: string, value: boolean) => {
    const newPrefs = { ...emailNotifications, [key]: value };
    setEmailNotifications(newPrefs);
    updatePreferencesMutation.mutate(newPrefs);
  };

  const handlePushNotificationChange = (key: string, value: boolean) => {
    setPushNotifications({ ...pushNotifications, [key]: value });
    // TODO: Update push notification preferences
  };

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-6"
      >
        <h3 className="text-base font-bold text-gray-900 mb-6">Email Notifications</h3>
        <div className="space-y-4">
          {Object.entries(emailNotifications).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-900 capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {key === "paymentApproved" && "Get notified when payments are approved"}
                  {key === "paymentDenied" && "Get notified when payments are denied"}
                  {key === "paymentExecuted" && "Get notified when payments are executed"}
                  {key === "requestReceived" && "Get notified when you receive payment requests"}
                  {key === "securityAlerts" && "Get notified about security events"}
                  {key === "weeklySummary" && "Receive a weekly summary of activity"}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => handleEmailNotificationChange(key, e.target.checked)}
                  disabled={updatePreferencesMutation.isPending}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black disabled:opacity-50"></div>
              </label>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Push Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-6"
      >
        <h3 className="text-base font-bold text-gray-900 mb-6">Push Notifications</h3>
        <div className="space-y-4">
          {Object.entries(pushNotifications).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-900 capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Receive browser push notifications
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => handlePushNotificationChange(key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
              </label>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
