import React, { useState } from "react";
import type { Beneficiary, RailsType } from "../types/wire";

interface WireBeneficiaryFormProps {
  onSubmit: (data: Partial<Beneficiary>) => void;
  onCancel: () => void;
}

export function WireBeneficiaryForm({ onSubmit, onCancel }: WireBeneficiaryFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("US");
  const [railsAllowed, setRailsAllowed] = useState<RailsType[]>(["ACH"]);
  const [bankLast4, setBankLast4] = useState("");

  const handleRailsChange = (rail: RailsType, checked: boolean) => {
    if (checked) {
      setRailsAllowed([...railsAllowed, rail]);
    } else {
      setRailsAllowed(railsAllowed.filter((r) => r !== rail));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      displayName,
      email: email || undefined,
      country,
      railsAllowed,
      bankLast4,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Display Name */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-2">
          Display Name
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g., Vendor ABC"
          className="w-full px-3 py-2 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 transition-all duration-200"
          required
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-2">
          Email Address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="beneficiary@example.com"
          className="w-full px-3 py-2 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 transition-all duration-200"
          required
        />
        <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
          We'll send a confirmation email to verify this beneficiary.
        </p>
      </div>

      {/* Country */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-2">
          Country
        </label>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full px-3 py-2 border-2 border-black rounded-xl bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 transition-all duration-200"
        >
          <option value="US">United States</option>
          <option value="GB">United Kingdom</option>
          <option value="CA">Canada</option>
          <option value="MX">Mexico</option>
        </select>
      </div>

      {/* Rails Allowed */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-2">
          Rails Allowed
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 border-2 border-black rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={railsAllowed.includes("ACH")}
              onChange={(e) => handleRailsChange("ACH", e.target.checked)}
              className="w-4 h-4 border-2 border-black rounded text-black focus:ring-2 focus:ring-black/20"
            />
            <span className="text-sm font-medium text-gray-900">ACH</span>
          </label>
          <label className="flex items-center gap-3 p-3 border-2 border-black rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={railsAllowed.includes("WIRE")}
              onChange={(e) => handleRailsChange("WIRE", e.target.checked)}
              className="w-4 h-4 border-2 border-black rounded text-black focus:ring-2 focus:ring-black/20"
            />
            <span className="text-sm font-medium text-gray-900">WIRE</span>
          </label>
        </div>
      </div>

      {/* Bank Last 4 */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-2">
          Bank Last 4 Digits
        </label>
        <input
          type="text"
          value={bankLast4}
          onChange={(e) => setBankLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="1234"
          className="w-full px-3 py-2 border-2 border-black rounded-xl text-sm font-medium font-mono focus:outline-none focus:ring-2 focus:ring-black/20 transition-all duration-200"
          maxLength={4}
          required
        />
        <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
          Only last 4 digits stored. Full account details are tokenized and hashed.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all duration-200 shadow-sm"
        >
          Create Beneficiary
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border-2 border-black rounded-xl hover:bg-gray-50 text-sm font-medium transition-all duration-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
