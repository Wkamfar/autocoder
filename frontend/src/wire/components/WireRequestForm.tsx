import React, { useState } from "react";
import { motion } from "framer-motion";
import type { PaymentRequest } from "../types/wire";
import { formatNumberWithCommas, parseFormattedNumber, numberToWordsWithCurrency } from "../utils/numberToWords";

interface WireRequestFormProps {
  onSubmit: (data: Partial<PaymentRequest>) => void;
}

export function WireRequestForm({ onSubmit }: WireRequestFormProps) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Remove all non-numeric characters except decimal point
    const cleaned = inputValue.replace(/[^\d.]/g, "");
    // Format with commas
    const formatted = formatNumberWithCommas(cleaned);
    setAmount(formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Parse the formatted number back to a number
    const numericAmount = parseFormattedNumber(amount);
    onSubmit({
      amountMinor: (numericAmount * 100).toString(),
      currency,
      invoiceNumber: invoiceNumber || undefined,
      dueDate: dueDate || undefined,
      purpose,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-2 border-black rounded-2xl bg-white overflow-hidden"
    >
      <header className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
        <h2 className="text-lg font-bold text-gray-900">Payment Request Details</h2>
        <p className="text-xs text-gray-500 mt-1">All fields are encrypted and tamper-proof</p>
      </header>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Amount */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
            Amount
          </label>
          <div className="flex gap-3">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-4 py-3 border-2 border-black rounded-xl bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-black/20"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
            <div className="flex-1 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                {currency === "USD" ? "$" : currency === "EUR" ? "€" : "£"}
              </span>
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 border-2 border-black rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-black/20"
                required
              />
            </div>
          </div>
          {/* Amount in words */}
          {amount && parseFormattedNumber(amount) > 0 && (
            <div className="mt-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Amount in words:</p>
              <p className="text-base font-semibold text-gray-900 leading-relaxed capitalize tracking-wide">
                {numberToWordsWithCurrency(parseFormattedNumber(amount), currency)}
              </p>
            </div>
          )}
        </div>

        {/* Invoice Number & Due Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Invoice Number (Optional)
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-2024-001"
              className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Due Date (Optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
            />
          </div>
        </div>

        {/* Purpose */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
            Purpose / Description
          </label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g., Payment for services rendered in Q4 2024"
            rows={4}
            className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 resize-none"
            required
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
            Supporting Documents (Optional)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-black transition-colors">
            <input
              type="file"
              id="file-upload"
              multiple
              accept=".pdf,.png,.jpg"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm font-medium text-gray-600">
                {files.length > 0 ? `${files.length} file(s) selected` : "Click to upload or drag and drop"}
              </p>
              <p className="text-xs text-gray-500 mt-1">PDF, PNG, JPG up to 10MB</p>
            </label>
          </div>
          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                    className="text-red-600 hover:text-red-800"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">Secure & Tamper-Proof</p>
              <p className="text-xs text-blue-700">
                Your request will be cryptographically signed and verified. Any tampering will be immediately detected.
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all shadow-sm"
          >
            Continue to Verification
          </button>
        </div>
      </form>
    </motion.div>
  );
}
