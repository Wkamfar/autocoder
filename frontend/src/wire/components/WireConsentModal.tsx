import React, { useState } from "react";
import { WireModal } from "../ui/WireModal";

interface WireConsentModalProps {
  onConsent: () => void;
  onCancel: () => void;
}

export function WireConsentModal({ onConsent, onCancel }: WireConsentModalProps) {
  const [consented, setConsented] = useState(false);

  return (
    <WireModal title="Consent Required" onClose={onCancel} className="max-w-md">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="text-xs text-gray-700 leading-relaxed">
            This call will record your approval statement for audit. Proceed?
          </p>
          <label className="flex items-start gap-3 p-3 border-2 border-black rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 w-4 h-4 border-2 border-black rounded text-black focus:ring-2 focus:ring-black/20"
            />
            <span className="text-xs font-medium text-gray-900">I consent</span>
          </label>
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={onConsent}
            disabled={!consented}
            className="flex-1 bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Call
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 border-2 border-black rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </WireModal>
  );
}
