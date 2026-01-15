/**
 * Error Boundary Component
 * 
 * Catches React errors and displays a fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { motion } from "framer-motion";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full border-2 border-red-500 rounded-2xl bg-white p-6 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-4">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            {import.meta.env.DEV && this.state.error && (
              <details className="text-left mb-4">
                <summary className="text-xs text-gray-500 cursor-pointer mb-2">Error details</summary>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all"
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = "/v2/")}
                className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
              >
                Go Home
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
