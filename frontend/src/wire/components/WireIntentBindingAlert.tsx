import React from "react";
import type { TransferIntent } from "../types/wire";
import { WireModal } from "../ui/WireModal";

interface WireIntentBindingAlertProps {
  intent: TransferIntent;
  onConfirm: () => void;
  onCancel: () => void;
}

export function WireIntentBindingAlert({
  intent,
  onConfirm,
  onCancel,
}: WireIntentBindingAlertProps) {
  return (
    <WireModal title="Warning" onClose={onCancel} className="max-w-md">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-900 leading-relaxed">
              <strong className="font-semibold">Warning:</strong> Editing this intent will invalidate all existing approvals and proofs. A new challenge will be required.
            </p>
          </div>
          <div className="text-xs text-gray-700 space-y-2">
            <div className="font-semibold text-gray-900 mb-2">The following will be invalidated:</div>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Existing voice proofs</li>
              <li>Approval decisions</li>
              <li>Approval tokens</li>
            </ul>
          </div>
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={onConfirm}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 text-sm font-medium transition-all duration-200 shadow-sm"
            >
              Continue
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 border-2 border-black rounded-xl hover:bg-gray-50 text-sm font-medium transition-all duration-200"
            >
              Cancel
            </button>
          </div>
      </div>
    </WireModal>
  );
}
