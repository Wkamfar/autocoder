import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { WireRequestForm } from "../components/WireRequestForm";
import { Badge } from "../../crm/ui/CrmDesignSystem";

type RequestStep = "form" | "verification" | "submitted";

export default function WireRequestPaymentPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-3xl mx-auto py-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-8"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Request Payment</h1>
            <p className="text-sm text-gray-600 mt-1">
              Coming soon. This flow will be enabled when the Requests API is live.
            </p>
          </div>
          <Badge tone="neutral">Coming soon</Badge>
        </div>
        <div className="mt-6">
          <button
            onClick={() => navigate("/requests")}
            className="px-4 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all"
          >
            Back to Requests
          </button>
        </div>
      </motion.div>
    </div>
  );
}
