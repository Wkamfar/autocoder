import React from "react";
import { motion } from "framer-motion";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function WireEmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      {icon && (
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4"
        >
          {icon}
        </motion.div>
      )}
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 max-w-md mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all duration-150 active:scale-95"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

export function WireLoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="relative w-12 h-12 mb-4">
        <div className="absolute inset-0 border-4 border-gray-200 rounded-full" />
        <motion.div
          className="absolute inset-0 border-4 border-black rounded-full border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
      <p className="text-sm text-gray-600 font-medium">{message}</p>
    </div>
  );
}

export function WireErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-red-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      {message && <p className="text-sm text-gray-600 max-w-md mb-6">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all duration-150 active:scale-95"
        >
          Try Again
        </button>
      )}
    </motion.div>
  );
}

export function WireSkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 bg-gray-50 rounded-xl animate-pulse border border-gray-100"
        />
      ))}
    </div>
  );
}

export function WireSkeletonCard() {
  return (
    <div className="border-2 border-gray-200 rounded-2xl bg-white p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
        <div className="h-3 bg-gray-200 rounded w-4/6" />
      </div>
    </div>
  );
}
