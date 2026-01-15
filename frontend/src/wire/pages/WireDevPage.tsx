import React, { useState } from "react";
import { MOCK_SERVICE_HEALTH } from "../data/mockData";
import type { ServiceHealth } from "../types/wire";

export default function WireDevPage() {
  const [health, setHealth] = useState<ServiceHealth>(MOCK_SERVICE_HEALTH);
  const [forceHighCoercion, setForceHighCoercion] = useState(false);
  const [forceSpoofRisk, setForceSpoofRisk] = useState(false);
  const [forceTranscriptMismatch, setForceTranscriptMismatch] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
              Development Tools
            </p>
            <h2 className="text-sm font-semibold text-gray-900">Dev Controls</h2>
          </div>
        </header>
      </div>

      {/* Service Health Panel */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-sm font-bold text-gray-900">Service Health</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
            <span className="text-xs font-medium text-gray-700">Voice Service</span>
            <select
              value={health.voiceService}
              onChange={(e) =>
                setHealth({
                  ...health,
                  voiceService: e.target.value as "healthy" | "degraded" | "down",
                })
              }
              className="px-3 py-1.5 text-xs border-2 border-black rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-black/20 font-medium"
            >
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="down">Down</option>
            </select>
          </label>
          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
            <span className="text-xs font-medium text-gray-700">Phone Service</span>
            <select
              value={health.phoneService}
              onChange={(e) =>
                setHealth({
                  ...health,
                  phoneService: e.target.value as "healthy" | "degraded" | "down",
                })
              }
              className="px-3 py-1.5 text-xs border-2 border-black rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-black/20 font-medium"
            >
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="down">Down</option>
            </select>
          </label>
          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
            <span className="text-xs font-medium text-gray-700">Storage Service</span>
            <select
              value={health.storageService}
              onChange={(e) =>
                setHealth({
                  ...health,
                  storageService: e.target.value as "healthy" | "degraded" | "down",
                })
              }
              className="px-3 py-1.5 text-xs border-2 border-black rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-black/20 font-medium"
            >
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="down">Down</option>
            </select>
          </label>
        </div>
      </div>

      {/* Mock Scenarios Panel */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-sm font-bold text-gray-900">Mock Scenarios</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={forceHighCoercion}
              onChange={(e) => setForceHighCoercion(e.target.checked)}
              className="w-4 h-4 border-2 border-black rounded text-black focus:ring-2 focus:ring-black/20"
            />
            <span className="text-xs font-medium text-gray-700">Force High Coercion Risk</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={forceSpoofRisk}
              onChange={(e) => setForceSpoofRisk(e.target.checked)}
              className="w-4 h-4 border-2 border-black rounded text-black focus:ring-2 focus:ring-black/20"
            />
            <span className="text-xs font-medium text-gray-700">Force Spoof Risk</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={forceTranscriptMismatch}
              onChange={(e) => setForceTranscriptMismatch(e.target.checked)}
              className="w-4 h-4 border-2 border-black rounded text-black focus:ring-2 focus:ring-black/20"
            />
            <span className="text-xs font-medium text-gray-700">Force Transcript Mismatch</span>
          </label>
        </div>
      </div>

      {/* Info Panel */}
      <div className="border-2 border-black rounded-xl bg-blue-50 p-4">
        <p className="text-xs text-blue-900 leading-relaxed">
          <strong className="font-semibold">Note:</strong> These toggles are for demo purposes only. In production, service health would be monitored automatically.
        </p>
      </div>
    </div>
  );
}
