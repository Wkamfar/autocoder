import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { wireApi } from "../api/client";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { useToast } from "../../crm/ui/CrmDesignSystem";

export default function WireSettingsProfilePage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      await wireApi.updateUser(user.id, {
        name: name.trim(),
      });
      await refreshUser();
      toast.push({
        tone: "success",
        message: "Profile updated successfully",
      });
    } catch (error) {
      toast.push({
        tone: "danger",
        message: error instanceof Error ? error.message : "Failed to update profile",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="border-2 border-gray-200 rounded-2xl bg-white p-6">
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h3 className="text-base font-bold text-gray-900 mb-4 sm:mb-6">Profile Information</h3>
        <div className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-xs sm:text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 sm:py-3 border-2 border-black rounded-xl text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 min-h-[44px] sm:min-h-0"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Email Address
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-3 sm:py-3 border-2 border-black rounded-xl text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 min-h-[44px] sm:min-h-0"
              />
              <Badge tone="success" className="text-xs self-start sm:self-center">Verified</Badge>
            </div>
            <p className="text-xs sm:text-xs text-gray-600 mt-2">
              A verification email will be sent if you change your email address.
            </p>
          </div>
          <div>
            <label className="block text-xs sm:text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              User ID
            </label>
            <div className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50">
              <p className="text-sm sm:text-sm font-mono text-gray-600 break-all">{user.id}</p>
            </div>
            <p className="text-xs sm:text-xs text-gray-600 mt-2">Your unique user identifier cannot be changed.</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3 sm:py-3 bg-black text-white text-base sm:text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 min-h-[44px] sm:min-h-0"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <button className="px-6 py-3 sm:py-3 border-2 border-black rounded-xl text-base sm:text-sm font-semibold hover:bg-gray-50 transition-all min-h-[44px] sm:min-h-0">
              Cancel
            </button>
          </div>
        </div>
      </motion.div>

      {/* Profile Picture */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h3 className="text-base font-bold text-gray-900 mb-4 sm:mb-6">Profile Picture</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white text-xl sm:text-2xl font-bold flex-shrink-0 self-center sm:self-start">
            {name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm sm:text-sm font-medium text-gray-900 mb-2">Update your profile picture</p>
            <p className="text-xs sm:text-xs text-gray-600 mb-4">
              Upload a new image. JPG, PNG or GIF. Max size 2MB.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button className="px-4 py-3 sm:py-2 bg-black text-white text-base sm:text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all min-h-[44px] sm:min-h-0">
                Upload Image
              </button>
              <button className="px-4 py-3 sm:py-2 border-2 border-black rounded-xl text-base sm:text-sm font-semibold hover:bg-gray-50 transition-all min-h-[44px] sm:min-h-0">
                Remove
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
